/**
 * What schools and publishers send SchoolShop to be verified. The keys match
 * the API's checks (apps/accounts/organisations.py). The phone check isn't here:
 * SchoolShop calls the number instead.
 */
export const orgDocuments = {
  school: [
    { key: "registration", label: "Ministry of Education registration certificate" },
    { key: "kra_pin", label: "KRA PIN certificate" },
    { key: "class_list", label: "Class list", hint: "Classes and how many students in each. CSV or Excel is easiest." },
  ],
  publisher: [
    { key: "registration", label: "Certificate of incorporation or business name" },
    { key: "kra_pin", label: "KRA PIN certificate" },
    { key: "payout_account", label: "Payout account proof", hint: "A bank letter, or a screenshot confirming your Paybill or Till." },
    { key: "catalog_sample", label: "Catalog or price list" },
  ],
} as const

export type OrgDocumentKey = (typeof orgDocuments)[keyof typeof orgDocuments][number]["key"]

/** The file types and size the API accepts for these documents. */
export const orgDocumentAccept = ".pdf,.jpg,.jpeg,.png,.csv,.xlsx"
export const orgDocumentMaxBytes = 10 * 1024 * 1024

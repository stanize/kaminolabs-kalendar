// Shared props shape every invoice template component takes — the
// React-PDF template's PROPS (invoice-content-payload, pdf-invoicing.md),
// not a JSON payload to an external API.
export interface InvoiceTemplateProps {
  business: {
    name: string;
    legalId: string | null;
    addressStreet: string;
    addressNumber: string;
    addressAdditional: string | null;
    city: string;
    addressPostalCode: string;
    addressProvince: string;
    addressCountry: string;
    contactEmail: string;
    phoneCountryCode: string;
    phoneNumber: string;
    professionalDni: string | null;
    professionalCollegeNumber: string | null;
    professionalName: string | null;
    signatureUrl: string | null;
    brandColor: string;
    isSolo: boolean;
  };
  client: {
    name: string;
    dni: string;
    address: string;
  };
  invoiceNumberFormatted: string; // "2026-0001"
  issueDate: string; // formatted display date
  serviceName: string;
  amount: number;
  paid: boolean; // whether the underlying booking is marked paid
  // invoice-qr-verification (spec-invoice-qr.md): the public verification
  // page's URL and a ready-to-embed PNG data URI QR encoding it, computed
  // by lib/invoices/render.ts (not the template's job to generate the QR
  // image itself).
  verificationUrl: string;
  qrDataUri: string;
}

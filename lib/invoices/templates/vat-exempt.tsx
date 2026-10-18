import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { InvoiceTemplateProps } from "./types";

// VAT-exempt invoice template — legal-requirements-check (pdf-invoicing.md).
// Visual layout (2026-10, invoice-layout-redesign) follows a reference
// mockup Arun supplied — card-style header, a "FACTURA" badge, a soft
// DATOS DEL CLIENTE box, and a Base Imponible/IVA/Total breakdown box —
// but the CONTENT stays exactly what we already collect (no client DNI/
// address fields exist, so none are shown; the payment-status badge from
// the mockup was explicitly declined in favor of keeping the existing
// PAGADO stamp near the signature). No avatar (removed per feedback).
// solo-provider-header: for a solo business, the header shows just the
// provider's name + DNI/colegiada instead of the clinic name/address —
// multi-provider header handling deferred for later.
const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },

  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  headerLeft: { maxWidth: "60%" },
  businessName: { fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 2 },
  businessSub: { fontSize: 9, color: "#6b7280", marginBottom: 1 },

  headerRight: { alignItems: "flex-end" },
  badge: {
    fontSize: 8,
    fontWeight: 700,
    color: "#4338ca",
    backgroundColor: "#eef2ff",
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  invoiceNumber: { fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 2 },
  issueDateText: { fontSize: 9, color: "#6b7280" },

  clientBox: { backgroundColor: "#f8fafc", borderRadius: 10, padding: 12, marginBottom: 20 },
  clientBoxLabel: { fontSize: 8, fontWeight: 700, color: "#94a3b8", letterSpacing: 0.5, marginBottom: 4 },
  clientName: { fontSize: 12, fontWeight: 700, color: "#111827", marginBottom: 2 },
  clientSub: { fontSize: 9, color: "#6b7280" },

  table: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, overflow: "hidden" },
  tableHeader: { flexDirection: "row", backgroundColor: "#f8fafc", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  tableHeaderCell: { fontSize: 8, fontWeight: 700, color: "#94a3b8", letterSpacing: 0.5, padding: 8 },
  tableRow: { flexDirection: "row", minHeight: 28 },
  colUd: { width: "10%", padding: 8 },
  colConcepto: { width: "55%", padding: 8 },
  colPrecio: { width: "17.5%", padding: 8, textAlign: "right" },
  colImporte: { width: "17.5%", padding: 8, textAlign: "right", fontWeight: 700 },

  bottomRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  exemptBox: { backgroundColor: "#f8fafc", borderRadius: 10, padding: 10, width: "48%", fontSize: 8.5, color: "#475569" },
  exemptBoxLabel: { fontSize: 8, fontWeight: 700, color: "#94a3b8", letterSpacing: 0.5, marginBottom: 4 },
  totalsBox: { width: "40%" },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  totalsLabel: { fontSize: 9.5, color: "#475569" },
  totalsValue: { fontSize: 9.5, color: "#111827" },
  totalsDivider: { borderBottomWidth: 1, borderBottomColor: "#e5e7eb", marginVertical: 6 },
  grandTotalLabel: { fontSize: 11, fontWeight: 700, color: "#111827" },
  grandTotalValue: { fontSize: 13, fontWeight: 700, color: "#4338ca" },

  signatureDivider: { marginTop: 48, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  signatureArea: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 24,
  },
  paidPill: {
    fontSize: 10.5,
    fontWeight: 700,
    color: "#059669",
    backgroundColor: "#ecfdf5",
    borderRadius: 11,
    paddingVertical: 5,
    paddingHorizontal: 11,
    alignSelf: "flex-start",
  },
  signatureBlock: { alignItems: "flex-end" },
  signatureImage: { width: 130, height: 50, objectFit: "contain", marginBottom: 4 },
  signatureName: { fontSize: 9.5, fontWeight: 700, color: "#111827" },
});

function fullAddressLine(b: InvoiceTemplateProps["business"]): string {
  const street = `${b.addressStreet} ${b.addressNumber}${b.addressAdditional ? `, ${b.addressAdditional}` : ""}`;
  return `${street} · ${b.addressPostalCode} ${b.city}, ${b.addressProvince}`;
}

export function VatExemptInvoice(props: InvoiceTemplateProps) {
  const { business, client, invoiceNumberFormatted, issueDate, serviceName, amount, paid } = props;
  const amountFormatted = amount.toFixed(2).replace(".", ",");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {business.isSolo ? (
              // solo-provider-header: just the provider + DNI/colegiada —
              // no clinic name/address/NIF. Multi-provider header handling
              // is deferred for later.
              <>
                <Text style={styles.businessName}>{business.professionalName || business.name}</Text>
                {(business.professionalDni || business.professionalCollegeNumber) && (
                  <Text style={styles.businessSub}>
                    {business.professionalDni ? `DNI: ${business.professionalDni}` : ""}
                    {business.professionalDni && business.professionalCollegeNumber ? " · " : ""}
                    {business.professionalCollegeNumber ? `Nºcolegiada: ${business.professionalCollegeNumber}` : ""}
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text style={styles.businessName}>{business.name}</Text>
                <Text style={styles.businessSub}>{fullAddressLine(business)}</Text>
                {business.legalId && <Text style={styles.businessSub}>NIF: {business.legalId}</Text>}
                {(business.professionalDni || business.professionalCollegeNumber) && (
                  <Text style={styles.businessSub}>
                    {business.professionalDni ? `DNI: ${business.professionalDni}` : ""}
                    {business.professionalDni && business.professionalCollegeNumber ? " · " : ""}
                    {business.professionalCollegeNumber ? `Nºcolegiada: ${business.professionalCollegeNumber}` : ""}
                  </Text>
                )}
              </>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.badge}>FACTURA</Text>
            <Text style={styles.invoiceNumber}>Nº {invoiceNumberFormatted}</Text>
            <Text style={styles.issueDateText}>Fecha de emisión: {issueDate}</Text>
          </View>
        </View>

        <View style={styles.clientBox}>
          <Text style={styles.clientBoxLabel}>DATOS DEL CLIENTE</Text>
          <Text style={styles.clientName}>{client.name}</Text>
          {client.dni && <Text style={styles.clientSub}>DNI: {client.dni}</Text>}
          {client.address && <Text style={styles.clientSub}>{client.address}</Text>}
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colUd]}>UD</Text>
            <Text style={[styles.tableHeaderCell, styles.colConcepto]}>CONCEPTOS</Text>
            <Text style={[styles.tableHeaderCell, styles.colPrecio]}>PRECIO</Text>
            <Text style={[styles.tableHeaderCell, styles.colImporte]}>IMPORTE</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.colUd}>1</Text>
            <Text style={styles.colConcepto}>{serviceName}</Text>
            <Text style={styles.colPrecio}>{amountFormatted} €</Text>
            <Text style={styles.colImporte}>{amountFormatted} €</Text>
          </View>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.exemptBox}>
            <Text style={styles.exemptBoxLabel}>EXENCIÓN DE IVA</Text>
            <Text>Operación exenta de I.V.A por el artículo 20 de la Ley 37/1992 de 28 de Diciembre.</Text>
          </View>

          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Base Imponible</Text>
              <Text style={styles.totalsValue}>{amountFormatted} €</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>IVA (Exento 0%)</Text>
              <Text style={styles.totalsValue}>0,00 €</Text>
            </View>
            <View style={styles.totalsDivider} />
            <View style={styles.totalsRow}>
              <Text style={styles.grandTotalLabel}>Total Factura</Text>
              <Text style={styles.grandTotalValue}>{amountFormatted} €</Text>
            </View>
          </View>
        </View>

        <View style={styles.signatureDivider} />
        <View style={styles.signatureArea}>
          <View>{paid && <Text style={styles.paidPill}>PAGADO</Text>}</View>
          <View style={styles.signatureBlock}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no alt prop (not a DOM element) */}
            {business.signatureUrl && <Image style={styles.signatureImage} src={business.signatureUrl} />}
            <Text style={styles.signatureName}>Fdo: {business.professionalName || business.name}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

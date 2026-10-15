import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { InvoiceTemplateProps } from "./types";

// VAT-exempt invoice template — legal-requirements-check (pdf-invoicing.md),
// grounded against a real factura from a podóloga client. No VAT section at
// all (not even a 0% line) — this template structurally never shows one,
// per that step's decision. Layout mirrors the real example: header with
// professional's DNI/name/colegiada number, client name, invoice number +
// date, a CONCEPTOS table, the VAT-exemption legal citation box, total, and
// a signature area.
const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },
  headerCenter: { textAlign: "center", marginBottom: 24 },
  headerLine: { marginBottom: 2 },
  clientBlock: { marginBottom: 20 },
  numberRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  numberBox: { border: "1pt solid #111827", padding: "4pt 8pt" },
  table: { border: "1pt solid #111827" },
  tableHeader: { flexDirection: "row", borderBottom: "1pt solid #111827", fontWeight: 700 },
  tableRow: { flexDirection: "row", minHeight: 24 },
  colUd: { width: "10%", padding: 4, borderRight: "1pt solid #111827" },
  colConcepto: { width: "55%", padding: 4, borderRight: "1pt solid #111827" },
  colPrecio: { width: "17.5%", padding: 4, borderRight: "1pt solid #111827", textAlign: "right" },
  colImporte: { width: "17.5%", padding: 4, textAlign: "right" },
  exemptBox: { border: "1pt solid #111827", padding: 8, marginTop: 16, width: "60%", fontSize: 9 },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 16 },
  totalBox: { border: "1pt solid #111827", padding: "4pt 10pt", fontWeight: 700 },
  signatureArea: { marginTop: 48 },
  signatureImage: { width: 140, height: 60, objectFit: "contain" },
  paidStamp: { marginTop: 8, fontWeight: 700, fontSize: 11 },
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
        <View style={styles.headerCenter}>
          {business.professionalDni && <Text style={styles.headerLine}>DNI: {business.professionalDni}</Text>}
          <Text style={styles.headerLine}>
            {business.name}
            {business.professionalCollegeNumber ? ` · Nºcolegiada: ${business.professionalCollegeNumber}` : ""}
          </Text>
          <Text style={styles.headerLine}>{fullAddressLine(business)}</Text>
        </View>

        <View style={styles.clientBlock}>
          <Text>{client.name}</Text>
        </View>

        <View style={styles.numberRow}>
          <Text style={styles.numberBox}>Nº {invoiceNumberFormatted}</Text>
          <Text style={styles.numberBox}>{issueDate}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colUd}>UD</Text>
            <Text style={styles.colConcepto}>CONCEPTOS</Text>
            <Text style={styles.colPrecio}>PRECIO</Text>
            <Text style={styles.colImporte}>IMPORTE</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.colUd} />
            <Text style={styles.colConcepto}>{serviceName}</Text>
            <Text style={styles.colPrecio}>{amountFormatted}</Text>
            <Text style={styles.colImporte}>{amountFormatted}</Text>
          </View>
        </View>

        <View style={styles.exemptBox}>
          <Text>Operación exenta de I.V.A por el artículo 20 de la Ley 37/1992 de 28 de Diciembre.</Text>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalBox}>Total: {amountFormatted} €</Text>
        </View>

        <View style={styles.signatureArea}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no alt prop (not a DOM <img>) */}
          {business.signatureUrl && <Image style={styles.signatureImage} src={business.signatureUrl} />}
          {paid && <Text style={styles.paidStamp}>PAGADO</Text>}
          <Text>{business.name}</Text>
        </View>
      </Page>
    </Document>
  );
}

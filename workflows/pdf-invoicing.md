# Workflow: PDF Invoicing

Cross-service workflow: Kalendar main app generating and serving PDF invoices via the separate PDF portal (stanize/kaminolabs-pdfs).

## Step: pdf-portal-schema
Status: done
Criteria:
- pdf_templates table exists (append-only versioned, compiled html/css + config jsonb) in PDF portal's Supabase project
- pdf_documents table exists (pinned to exact template version at generate time, access_token, data jsonb, nullable storage_path)
- Private storage bucket pdf-documents exists

## Step: pdf-portal-api
Status: done
Criteria:
- POST /api/templates and GET /api/templates exist in stanize/kaminolabs-pdfs
- POST /api/generate exists and pins the generated document to a specific template version
- GET /d/{id}?token= renders and caches via Puppeteer + @sparticuz/chromium
- app_id "kalendar" and template IDs invoice-pending / invoice-paid are recognized

## Step: pdf-portal-env-config
Status: not_started
Criteria:
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_APP_URL set on the PDF portal's Vercel project
- APP_API_KEY_KALENDAR set on the PDF portal's Vercel project
- Matching PDFS_API_KEY set on Kalendar's Vercel project

## Step: template-seeding
Status: not_started
Criteria:
- An initial invoice-pending template version exists in pdf_templates
- An initial invoice-paid template version exists in pdf_templates

## Step: kalendar-invoice-numbering
Status: not_started
Criteria:
- kalendar_invoices table exists on the main Kalendar Supabase project
- Sequential invoice numbering is implemented
- Numbering scheme has been verified against Spanish factura legal requirements with an accountant

## Step: invoice-generation-trigger
Status: not_started
Criteria:
- An appointment-completed (or subscription-payment) event triggers a call to POST /api/generate
- Generated invoice is linked back to the relevant kalendar_bookings or billing record
- Guest/clinic can access the invoice via the returned access_token link

## Step: admin-template-editor
Status: not_started
Criteria:
- Kalendar admin portal has a UI for creating/editing PDF template versions
- Editor writes new versions to pdf_templates without mutating existing versions

## Notes / Deviations
(freeform — anything found in code that doesn't map to a defined step)

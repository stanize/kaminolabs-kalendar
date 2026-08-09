import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-session";
import { getPatientProfile } from "@/lib/actions/patient";
import { getPatientBookings } from "@/lib/booking/patient-data";
import { PatientBookingsList } from "@/components/patient/patient-bookings-list";
import { PatientHeader } from "@/components/patient/patient-header";

export default async function PatientBookingsPage() {
  await requireSession();
  const profile = await getPatientProfile();
  if (!profile) redirect("/patient/login");

  const bookings = await getPatientBookings(profile.id);

  return (
    <div className="min-h-dvh bg-surface-2">
      <PatientHeader current="bookings" />

      <div className="mx-auto max-w-[680px] px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="mb-6 text-[24px]">Todas tus reservas</h1>
        <PatientBookingsList bookings={bookings} />
      </div>
    </div>
  );
}

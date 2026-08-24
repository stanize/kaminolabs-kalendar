import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth-session";
import { getClientDetail, getClientNotes } from "@/lib/clients/data";
import { getLocale } from "@/lib/i18n/server";
import { getClientsDictionary } from "@/lib/i18n/dictionaries/clients";
import { Icon } from "@/components/ui/icon";
import { ClientDetailView } from "@/components/panel/client-detail-view";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const locale = await getLocale();
  const dict = getClientsDictionary(locale);

  const [client, notes] = await Promise.all([
    getClientDetail(session.user.id, id),
    getClientNotes(session.user.id, id),
  ]);

  if (!client) notFound();

  return (
    <div className="mx-auto max-w-[760px] px-4 py-6 sm:px-8 sm:py-8">
      <Link
        href="/panel/clients"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-soft hover:text-ink"
      >
        <Icon name="chevronLeft" size={14} /> {dict.detail.back}
      </Link>

      <ClientDetailView client={client} initialNotes={notes} dict={dict} locale={locale} />
    </div>
  );
}

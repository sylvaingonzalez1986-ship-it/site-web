import { redirect } from "next/navigation";
import Link from "@/components/navigation/NavigationLink";
import { ArenaPrizeDeliveryForm } from "@/components/contest/ArenaPrizeDeliveryForm";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { getArenaPrizeDeliveries } from "@/lib/supabase/arena-customer-rewards-backend";

export const metadata = { title: "Mes lots de l’Arène", robots: { index: false, follow: false } };

export default async function ArenaPrizesPage() {
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) redirect("/compte/connexion?next=%2Farene%2Flots");
  const deliveries = await getArenaPrizeDeliveries(session.customerId).catch(() => null);
  return <main className="mx-auto grid w-full max-w-2xl gap-5 px-4 py-8">
    <Link href="/arene?vue=classement" className="underline">Retour au classement</Link>
    <h1 className="text-3xl font-black">Mes lots de l’Arène</h1>
    {deliveries === null ? <p role="alert">Tes lots sont momentanément indisponibles.</p>
      : deliveries.length === 0 ? <p>Aucun lot à réclamer.</p>
        : <ul className="grid gap-4">{deliveries.map(delivery => <li key={delivery.id} className="border-t border-current pt-4">
          <h2 className="text-xl font-bold">{delivery.grams} g de fleurs · {delivery.seasonCode}</h2>
          <p>{delivery.kind === "surprise" ? "Fleur Surprise" : "Classement général"}</p>
          <ArenaPrizeDeliveryForm delivery={delivery} />
        </li>)}</ul>}
  </main>;
}

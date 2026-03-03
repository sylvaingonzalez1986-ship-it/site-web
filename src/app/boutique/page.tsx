import { BoutiquePageClient } from "@/components/boutique/BoutiquePageClient";
import { readPublicStoreByBackend } from "@/lib/data-backend";

export default async function BoutiquePage() {
  const store = await readPublicStoreByBackend();

  return <BoutiquePageClient initialStore={store} />;
}

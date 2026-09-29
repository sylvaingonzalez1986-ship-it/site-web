import type { ReactNode } from "react";
import styles from "@/components/admin/AdminTheme.module.css";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className={styles.theme}>{children}</div>;
}

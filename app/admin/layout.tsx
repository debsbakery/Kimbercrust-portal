import { ReactNode } from "react";

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="bg-stone-50 min-h-[calc(100vh-4rem)]">
      {children}
    </div>
  );
}
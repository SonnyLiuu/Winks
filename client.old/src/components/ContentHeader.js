"use client.old";
import { usePathname } from "next/navigation";

export default function ContentHeader() {
  const pathname = usePathname();

  const routeToNameMap = {
    "/account": "Account",
    "/settings": "Settings",
  };

  const pageName = routeToNameMap[pathname] || "Unknown Page";

  return (
    <header
      style={{
        background: "#ddd",
        height: "100px",
        padding: "20px",
        boxSizing: "border-box",
        borderLeft: "1px solid #FF0000",
        borderBottom: "1px solid #FF0000",
      }}
    >
      <h1>{pageName}</h1>
    </header>
  );
}

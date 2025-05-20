// app/layout.js
import "../styles/globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, height: "100%", width: "100%" }}>
        <div style={{ minHeight: "100vh" }}>
          {/* This <main> will wrap ALL nested layouts and pages */}
          <main style={{ height: "100%", width: "100%" }}>{children}</main>
        </div>
      </body>
    </html>
  );
}

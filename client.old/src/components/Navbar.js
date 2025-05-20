import Link from "next/link";

export default function Navbar() {
  return (
    <nav
      style={{
        width: "280px",
        flex: 1,
        background: "#f0f0f0",
        borderSizing: "border-box",
      }}
    >
      <ul>
        <li>
          <Link href="/account">Account</Link>
        </li>
        <li>
          <Link href="/settings">Settings</Link>
        </li>
        <li>
          <button>Logout</button>
        </li>
      </ul>
    </nav>
  );
}

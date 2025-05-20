import Link from "next/link";
import Image from "next/image";
export default function HomePage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
      }}
    >
      <Image src="/images/logo.png" alt="Winks logo" width={500} height={500} />
      <p>Calibrate to continue</p>
      <Link href="/account">
        <button>Calibrate</button>
      </Link>
    </div>
  );
}

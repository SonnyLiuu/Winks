import Image from "next/image";

export default function Header() {
  return (
    <header
      style={{
        height: "100px",
        width: "280px",
        boxSizing: "border-box",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: "30%",
        borderRight: "1px solid #00FF00",
        borderBottom: "1px solid #00FF00",
      }}
    >
      <Image src="/images/logo.png" alt="Winks Logo" width={100} height={100} />
      <Image
        src="/images/profile_icon.png"
        alt="Profile Icon"
        width={40}
        height={40}
      />


    </header>
  );
}

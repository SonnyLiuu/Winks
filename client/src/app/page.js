import Link from "next/link";
import Image from "next/image";
import "../styles/homepage.css";

export default function HomePage() {
  return (
    <div className="home-container">
      <Image
        src="/images/logo2.png"
        alt="Winks logo"
        width={2000}
        height={2000}
        className="home-logo"
      />

      <div className="home-heading-with-tooltip">
        <h1 className="home-heading">Welcome to Winks!</h1>
        <div className="tooltip-container">
          <span className="tooltip-icon">?</span>
          <div className="tooltip-text">
            Winks is a hands-free, eye-controlled interface designed to enhance accessibility and interaction. 
            Blink and move with precision, no mouse or touch needed.
          </div>
        </div>
      </div>
      <p className="home-subtext">Lets begin your journey!</p>
      <Link href="/login">
        <button className="home-button">Dive in</button>
      </Link>
      <p className="signup-prompt">
        New here? <Link href="/signup">Sign up</Link>
      </p>  

      <Link href="/account">
        <button className="btn">account page (Dev purposes)</button>
      </Link>
    </div>
  );
}

import Link from "next/link";
import "../../styles/auth.css";

export default function LoginPage() {
  return (
    <div className="auth-page">
      <div className="auth-container">
        <h2>Login</h2>
        <form className="auth-form">
          <input type="email" placeholder="Email" required />
          <input type="password" placeholder="Password" required />
          <button type="submit">Log In</button>
          <p className="signup-prompt">
            New here? <Link href="/signup">Sign up</Link>
          </p> 
        </form>
      </div>
    </div>
  );
}
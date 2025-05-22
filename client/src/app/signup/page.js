import "../../styles/auth.css";

export default function SignupPage() {
    return (
        <div className="auth-page">
        <div className="auth-container">
          <h2>Sign Up</h2>
          <form className="auth-form">
            <input type="email" placeholder="Email" required />
            <input type="password" placeholder="Password" required />
            <button type="submit">Sign Up</button>
          </form>
        </div>
      </div>
    );
  }
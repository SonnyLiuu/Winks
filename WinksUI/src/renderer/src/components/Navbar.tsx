function Header(): React.JSX.Element {

  return (
    <nav
      style={{
        width: "280px",
        flex: 1,
        background: "#f0f0f0",
        boxSizing: "border-box",
      }}
    >
      <ul>
        <li>
          <a href="">Account</a>
        </li>
        <li>
          <a href="">Settings</a>
        </li>
        <li>
          <button>Logout</button>
        </li>
      </ul>
    </nav>
  )
}

export default Header

import { assets } from '../assets/assets.ts'

function Header(): React.JSX.Element {

  return (
    <header style={{
      height: "100px",
      width: "280px",
      boxSizing: "border-box",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      gap: "30%",
      borderRight: "1px solid #00FF00",
      borderBottom: "1px solid #00FF00",
    }}>
      <img src={assets.logo} alt="Winks Logo" width={100} height={100}/>
      <img
        src={assets.profileIcon}
        alt="Profile Icon"
        width={40}
        height={40}
      />
    </header>
  )
}

export default Header

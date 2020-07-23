import React, { Component } from 'react';
import { TOKEN_KEY } from "../constants"
import TopBar from './TopBar';
import Main from './Main';

import '../styles/App.css';

class App extends Component {
  state = {
    isLoggedIn: Boolean(localStorage.getItem(TOKEN_KEY))
  }
  render() {
    return (
      <div className="App">
        <TopBar isLoggedIn={this.state.isLoggedIn}
          handleLogout={this.handleLogout} />
        <Main handleLoginSucceed={this.handleLoginSucceed}
          isLoggedIn={this.state.isLoggedIn} />
      </div>
    )
  }

  handleLoginSucceed = (token) => {
    console.log(token)
    localStorage.setItem(TOKEN_KEY, token)
    this.setState({
      isLoggedIn: true
    })
  }

  handleLogout = () => {
    console.log("logout")
    localStorage.removeItem(TOKEN_KEY)
    this.setState({
      isLoggedIn: false
    })
  }
}
export default App;



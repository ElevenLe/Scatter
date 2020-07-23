import React, {Component} from 'react';
import logo from '../assets/images/logo.svg';
import { Icon } from 'antd';

class TopBar extends Component {
   render() {
       return (
           <header className="App-header">
               <img src={logo} alt="logo" className="App-logo"/>
               <span className="App-title">Around</span>
               {
                   this.props.isLoggedIn ? 
                        <a className="logout" onClick={this.props.handleLogout}>
                            <Icon type="logout"></Icon>
                        </a> : null 
               }
           </header>
       );
   }
}

export default TopBar;

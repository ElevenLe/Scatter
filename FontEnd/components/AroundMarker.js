import React, { Component } from 'react';

import { Marker, InfoWindow } from 'react-google-maps';

import PropTypes from 'prop-types';

import blueIcon from "../assets/images/blue-marker.svg";

class AroundMarker extends Component{
    static propTypes = {
        post: PropTypes.object.isRequired,
    }
    // use state to control open or close
    state = {
        isOpen: false
    }

    render(){
        const {isOpen} = this.state
        const {url, user, message, location, type} = this.props.post
        const {lat, lon} = location

        const isImage = type === "image"
        const customizedIcon = isImage ? undefined : {
            url: blueIcon,
            scaledSize: new window.google.maps.Size(26, 41),
        }
        // data flow : home -> AroundMap -> AroundMarker
        return (
            <Marker position={{ lat, lng:lon}}
                    onClick={isImage ? this.handleToggle : undefined}
                    icon = {customizedIcon}
                    onMouseOver={isImage ? this.handleToggle : undefined}
                    onMouseOut={isImage ? this.handleToggle : undefined}
                    >
                    {
                        isOpen ? (<InfoWindow>
                                    <div>
                                        {
                                            isImage ?  <img src={url} 
                                            alt={message}
                                            className="around-marker-image"></img> :
                                            <video src={url} constrols className="around_marker_video"></video>
                                        }
                                       
                                        <p>{`${user}: ${message}`}</p>
                                    </div>      
                            </InfoWindow>) : null
                    }
            </Marker>
        )
    }

    handleToggle = () => {
        this.setState(preState => ({isOpen : !preState.isOpen}))
    }
}

export default AroundMarker
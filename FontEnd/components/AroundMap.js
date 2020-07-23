import React, { Component } from 'react';
import { POS_KEY } from '../constants';

import {
    withScriptjs,
    withGoogleMap,
    GoogleMap,
} from "react-google-maps";

import AroundMarker from "./AroundMarker"

class NormalAroundMap extends Component {
    render() {
        // here is get current location
        const { lat, lon } = JSON.parse(localStorage.getItem(POS_KEY));
        // onDragEnd and onZoomChanged is when map move, what is reload
        return (
            <GoogleMap
                ref={this.getMapRef}
                defaultZoom={11}
                defaultCenter={{ lat, lng: lon }}
                onDragEnd={this.reloadMarker}
                onZoomChanged={this.reloadMarker}>
                {
                    this.props.posts.map(
                        post => <AroundMarker post={post}/>
                    )
                }
            </GoogleMap>
        );
    }

    // mapInstance is GoogleMap
    getMapRef = (mapInstance) => {
        this.map = mapInstance;
        // gloable variable, so that we can drag and drop
        window.map = mapInstance;
    }

    // when drag the map, re-center the map and radius. And load the posts
    reloadMarker = () => {
        // get center
        const center = this.getCenter();
        // get radius
        const radius = this.getRadius();
        this.props.loadPostsByTopic(center, radius);
    }
    
    getCenter() {
        // this.map is already given
        // this.map.getCenter is from Google 
        const center = this.map.getCenter();
        // this is actual center obj
        return { lat: center.lat(), lon: center.lng() };
    }

    getRadius() {
        const center = this.map.getCenter();
        // from Doc 
        const bounds = this.map.getBounds();
        if (center && bounds) {
            const ne = bounds.getNorthEast();
            const right = new window.google.maps.LatLng(center.lat(), ne.lng());
            return 0.001 * window.google.maps.geometry.spherical.computeDistanceBetween(center, right);
        }
    }
}

// HOC provided by Google, must use
// withGoogle HOC is for DOM instances
// withScriptjs HOS is for v3
const AroundMap = withScriptjs(withGoogleMap(NormalAroundMap));

export default AroundMap;

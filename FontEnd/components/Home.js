import React, { Component } from 'react';

import { Tabs, Spin, Row, Col, Radio } from 'antd';
import {
    GEO_OPTIONS,
    POS_KEY,
    API_ROOT,
    AUTH_HEADER,
    TOKEN_KEY,
    POST_TYPE_IMAGE,
    POST_TYPE_VIDEO,
    POST_TYPE_UNKNOWN,
    TOPIC_AROUND,
    TOPIC_FACE,
} from '../constants';

import Gallery from "./Gallery"
import CreatePostButton from "./CreatePostButton"
import AroundMap from "./AroundMap"

const { TabPane } = Tabs


class Home extends Component {
    state = {
        posts: [],
        err: "",
        isLoadingGeoLocation: false,
        isLoadingPosts: false,
        topic: TOPIC_AROUND
    }

    // When the component is rendered to the DOM for the first time
    // such as at page load we call the Geolocation API to determine
    // a latitude and longitude for the browser
    render() {
        const operations = <CreatePostButton loadNearbyPosts={this.loadNearbyPosts} />;
        return (
            <div>
                <Radio.Group onChange={this.handleTopicChange} value={this.state.topic}>
                    <Radio value={TOPIC_AROUND}>Post around me</Radio>
                    <Radio value={TOPIC_FACE}>Faces Around World</Radio>
                </Radio.Group>
                <Tabs tabBarExtraContent={operations} className="main-tabs">
                    <TabPane tab="Image Posts" key="1">
                        {this.renderPosts(POST_TYPE_IMAGE)}
                    </TabPane>
                    <TabPane tab="Video Posts" key="2">
                        {this.renderPosts(POST_TYPE_VIDEO)}
                    </TabPane>
                    <TabPane tab="Map" key="3">
                        <AroundMap
                            googleMapURL="https://maps.googleapis.com/maps/api/js?key=AIzaSyD3CEh9DXuyjozqptVB5LA-dN7MxWWkr9s&v=3.exp&libraries=geometry,drawing,places"
                            loadingElement={<div style={{ height: `100%` }} />}
                            containerElement={<div style={{ height: `600px` }} />}
                            mapElement={<div style={{ height: `100%` }} />}
                            posts={this.state.posts}
                            loadPostsByTopic={this.loadPostsByTopic}
                        />
                    </TabPane>
                </Tabs>
            </div>
        );
    }

    handleTopicChange = (e) => {
        const topic = e.target.value
        this.setState({
            topic
        })

        if (topic === TOPIC_AROUND){
            this.loadNearbyPosts()
        }else{
            this.loadFacesAroundTheWolrd()
        }
    }

    componentDidMount() {
        if ("geolocation" in navigator) {
            this.setState({ isLoadingGeoLocation: true, err: '' })
            navigator.geolocation.getCurrentPosition(
                // success callback function
                this.onSuccessLocation,
                // fail callback function
                this.onFailedLoadGeoLocation,
                GEO_OPTIONS,
            )
        } else {
            this.setState({
                err: "fetch cannot success"
            })
        }
    }

    onSuccessLocation = (position) => {
        const { latitude, longitude } = position.coords
        localStorage.setItem(POS_KEY, JSON.stringify({ lat: latitude, lon: longitude }))

        // why 
        this.setState({ isLoadingGeoLocation: false, err: "" });
        this.loadNearbyPosts()
    }

    // why on both success and fail, we need to set up isLoadingGeoLocation
    onFailedLoadGeoLocation = () => {
        this.setState({ isLoadingGeoLocation: false, err: "Faild to load geo location" })
    }

    loadFacesAroundTheWolrd = () =>{
        // get token
        const token = localStorage.getItem(TOKEN_KEY)
        this.setState({
            isLoadingPosts: true,
            err: ""
        })

        return fetch(`${API_ROOT}/cluster?term=face`,{
            method: "GET",
            headers: {
                Authorization: `${AUTH_HEADER} ${token}`
            }
        }).then(response => {
            if(response.ok){
                console.log(response)
                return response.json()
            }
            throw new Error("Failed to load around world")
        }).then( data => { // data is actual data
            this.setState({
                posts: data ? data : [],
                // loading finish
                isLoadingPosts: false
            })
        }).catch(err => {
            console.log(err);
            this.setState({
                isLoadingPosts: false,
                err: err.message
            })
        })

    }
    // center radius is from aroundMap.js. When map is drag, reload the map location and posts
    loadNearbyPosts = (center, radius) => {
        // see if center, radius is exits, if exits, use it, otherwise using localStrorage
        const { lat, lon } = center ? center : JSON.parse(localStorage.getItem(POS_KEY))
        const range = radius ? radius : 20000;
        const token = localStorage.getItem(TOKEN_KEY)

        this.setState({
            isLoadingPosts: true,
            err: ""
        })
        return fetch(`${API_ROOT}/search?lat=${lat}&lon=${lon}&range=${range}`, {
            method: "GET",
            headers: { Authorization: `${AUTH_HEADER} ${token}` }
        })
            .then((response) => {
                if (response.ok) {
                    return response.json()
                }
                throw new Error("Failed to load post")
            })
            .then(data => {
                this.setState({
                    posts: data ? data : [],
                    // why we need to set up fales here?
                    isLoadingPosts: false
                })
            })
            .catch(err => {
                console.log("err", err)
                this.setState({
                    // why we need isloadingPosts here? 
                    isLoadingPosts: false,
                    err: "fetch posts failed"
                })
            })
    }

    renderImagePosts() {
        const { posts } = this.state;
        const images = posts
            .filter((post) => post.type === POST_TYPE_IMAGE)
            .map((post) => {
                return {
                    user: post.user,
                    src: post.url,
                    thumbnail: post.url,
                    caption: post.message,
                    thumbnailWidth: 400,
                    thumbnailHeight: 300,
                };
            });
        return <Gallery images={images} />
    }

    renderVideoPosts() {
        const { posts } = this.state;
        return (
            // row and col is used to create the grid
            // must row first, col second
            // gutter is antd space, 上下间隔
            <Row gutter={30}>
                {
                    posts
                        .filter((post) => [POST_TYPE_VIDEO, POST_TYPE_UNKNOWN].includes(post.type))
                        .map((post) => (
                            // create video tage and who load it
                            // must have the key
                            // span is decided how much col to have 
                            <Col span={6} key={post.url}>
                                <video src={post.url}
                                    controls={true}
                                    className="video-block" />
                                <p>{post.user}: {post.message}</p>
                            </Col>
                        ))
                }
            </Row>
        )
    }

    renderPosts(type) {
        // step 1 : get the data
        const { posts, err, isLoadingGeoLocation, isLoadingPosts } = this.state;

        // err 
        if (err) {
            return err
        } else if (isLoadingGeoLocation) {
            // load geolocation
            return <Spin tip="Loading GEO location..." />
        } else if (isLoadingPosts) {
            // load posts
            return <Spin tip="Loading posts..." />
        } else if (posts.length > 0) {
            //get post
            return type === POST_TYPE_IMAGE ? this.renderImagePosts() : this.renderVideoPosts()
        } else {
            return 'No nearby posts';
        }
    }

    loadPostsByTopic = (center, radius) => {
        const{ topic } = this.state
        if(topic === TOPIC_AROUND){
            return this.loadNearbyPosts(center, radius)
        }else{
            return this.loadFacesAroundTheWolrd()
        }
    }
} 

export default Home;

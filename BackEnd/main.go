package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"reflect"
	"strconv"

	"cloud.google.com/go/storage"
	jwtmiddleware "github.com/auth0/go-jwt-middleware"
	jwt "github.com/dgrijalva/jwt-go"
	"github.com/gorilla/mux"
	"github.com/olivere/elastic"
	"github.com/pborman/uuid"
)

// map cannot be const in GO
var (
	mediaTypes = map[string]string{
		".jpeg": "image",
		".jpg":  "image",
		".gif":  "image",
		".png":  "image",
		".mov":  "video",
		".mp4":  "video",
		".avi":  "video",
		".flv":  "video",
		".wmv":  "video",
	}
)

const (
	POST_INDEX = "post"
	DISTANCE   = "200km"

	ES_URL      = "http://10.128.0.2:9200"
	BUCKET_NAME = "around-bucket-0805"
)

type Location struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}

type Post struct {
	// `json:"user"` is for the json parsing of this User field. Otherwise, by default it's 'User'.
	User     string   `json:"user"`
	Message  string   `json:"message"`
	Location Location `json:"location"`
	// url is get from gcs
	Url string `json:"url"`
	// type is for front end, that if type is video or picture
	Type string `json:"type"`
	// face is the percentage of if a face showed in the Face
	Face float32 `json:"face"`
}

func main() {
	fmt.Println("started-service")
	// http.HandleFunc("/post", handlerPost)
	// http.HandleFunc("/search", handlerSearch)
	// same as servlet mapping
	// here http have not seperate the POST, PUT, GET.  Here is not a RPC
	// http.HandleFunc("/cluster", handlerCluster)
	jwtMiddleware := jwtmiddleware.New(jwtmiddleware.Options{
		ValidationKeyGetter: func(token *jwt.Token) (interface{}, error) {
			return []byte(mySigningKey), nil
		},
		SigningMethod: jwt.SigningMethodHS256,
	})

	// router is when a request come, how to you route it to where
	r := mux.NewRouter()

	r.Handle("/post", jwtMiddleware.Handler(http.HandlerFunc(handlerPost))).Methods("POST", "OPTIONS")
	r.Handle("/search", jwtMiddleware.Handler(http.HandlerFunc(handlerSearch))).Methods("GET", "OPTIONS")
	r.Handle("/cluster", jwtMiddleware.Handler(http.HandlerFunc(handlerCluster))).Methods("GET", "OPTIONS")
	r.Handle("/signup", http.HandlerFunc(handlerSignup)).Methods("POST", "OPTIONS")
	r.Handle("/login", http.HandlerFunc(handlerLogin)).Methods("POST", "OPTIONS")

	log.Fatal(http.ListenAndServe(":8080", r))

}

func handlerPost(w http.ResponseWriter, r *http.Request) {
	// Parse from body of request to get a json object.
	fmt.Println("Received one post request")

	w.Header().Set("Content-Type", "application/json")

	// domain change checking header
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// support login auth
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization")

	if r.Method == "OPTIONS" {
		return
	}

	user := r.Context().Value("user")
	claims := user.(*jwt.Token).Claims
	username := claims.(jwt.MapClaims)["username"]

	// Read parameter from client
	// data is in the post body because of picture format
	lat, _ := strconv.ParseFloat(r.FormValue("lat"), 64)
	lon, _ := strconv.ParseFloat(r.FormValue("lon"), 64)

	p := &Post{
		User:    username.(string),
		Message: r.FormValue("message"),
		Location: Location{
			Lat: lat,
			Lon: lon,
		},
	}

	// save image to GCS
	file, header, err := r.FormFile("image")
	if err != nil {
		http.Error(w, "Failed to read image from request", http.StatusBadRequest)
		return
	}
	// see the file type

	suffix := filepath.Ext(header.Filename)
	if t, ok := mediaTypes[suffix]; ok {
		p.Type = t
	} else {
		p.Type = "unknown"
	}

	id := uuid.New()
	mediaLink, err := saveToGCS(file, id)
	if err != nil {
		http.Error(w, "Failed to save to GCS", http.StatusInternalServerError)
		return
	}

	// here is for the front end, which may not live in google cloud
	p.Url = mediaLink

	// annotate image with vision api
	if p.Type == "image" {
		// Sprintf is print the result into variable
		uri := fmt.Sprintf("gs://%s/%s", BUCKET_NAME, id)
		// annotate is function from other file, for go, there is no need to import if in same package
		if score, err := annotate(uri); err != nil {
			http.Error(w, "Failed to annotate image", http.StatusInternalServerError)
			return
		} else {
			p.Face = score
		}
	}
	// save post to ES
	err = saveToES(p, POST_INDEX, id)
	if err != nil {
		http.Error(w, "Failed to save to ElasticSearch", http.StatusInternalServerError)
	}

	fmt.Println("Post is saved in the Database")
}

func handlerSearch(w http.ResponseWriter, r *http.Request) {
	fmt.Println("Received one search request")

	w.Header().Set("Content-Type", "application/json")

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization")

	if r.Method == "OPTIONS" {
		return
	}

	// create query from search request and variable inside
	// it is a GET request, which the parameter is followed in url, after ?

	lat, _ := strconv.ParseFloat(r.URL.Query().Get("lat"), 64)
	lon, _ := strconv.ParseFloat(r.URL.Query().Get("lon"), 64)
	ran := DISTANCE
	// now val in one line, the scope of val remain in IF
	if val := r.URL.Query().Get("range"); val != "" {
		ran = val + "km"
	}

	// here is geo relative search, so use geodistancequery
	query := elastic.NewGeoDistanceQuery("location")
	query = query.Distance(ran).Lat(lat).Lon(lon)
	searchResult, err := readFromES(query, POST_INDEX)
	if err != nil {
		// not good for panic here because there millions of request everyday, if every handle, then would to much
		http.Error(w, "Failed to read from Elastsearch", http.StatusInternalServerError)
		return
	}

	posts := getPostFromSearchResult(searchResult)
	// transfer post type data to json
	js, err := json.Marshal(posts)

	if err != nil {
		http.Error(w, "Failed to parse search result to JSON format", http.StatusInternalServerError)
		return
	}
	w.Write(js)
}

func readFromES(query elastic.Query, index string) (*elastic.SearchResult, error) {
	client, err := elastic.NewClient(elastic.SetURL(ES_URL))
	if err != nil {
		return nil, err
	}

	searchResult, err := client.Search().
		Index(index).
		Query(query).
		Pretty(true).
		Do(context.Background())

	if err != nil {
		return nil, err
	}
	return searchResult, nil
}

func getPostFromSearchResult(searchResult *elastic.SearchResult) []Post {
	var posts []Post
	var ptype Post
	for _, item := range searchResult.Each(reflect.TypeOf(ptype)) {
		p := item.(Post)
		posts = append(posts, p)
	}

	return posts
}

// return string: return the url given by the GCS
// objectName is the final name of the file you upload
func saveToGCS(r io.Reader, objectName string) (string, error) {
	ctx := context.Background()

	client, err := storage.NewClient(ctx)
	if err != nil {
		return "", err
	}

	bucket := client.Bucket("around-bucket-0805")
	// check if buck exits
	if _, err := bucket.Attrs(ctx); err != nil {
		return "", err
	}

	object := bucket.Object(objectName)
	wc := object.NewWriter(ctx)

	if _, err = io.Copy(wc, r); err != nil {
		return "", err
	}
	if err := wc.Close(); err != nil {
		return "", err
	}

	// ACL as access control
	// set is change the access permission
	// the default permission user(uploader) only. Or login GCS user
	// The user identity is conformed by GCE. Now the program is running in GCE, and request is sent by GCE
	// GCE is identified by service account, which is used in micro service
	// now default permission is current service account. Change it to all users
	if err := object.ACL().Set(ctx, storage.AllUsers, storage.RoleReader); err != nil {
		return "", err
	}

	attrs, err := object.Attrs(ctx)
	if err != nil {
		return "", err
	}

	fmt.Printf("Image is saved to GCS: %s\n", attrs.MediaLink)
	return attrs.MediaLink, nil

}

func saveToES(i interface{}, index string, id string) error {
	client, err := elastic.NewClient(elastic.SetURL(ES_URL))

	if err != nil {
		return err
	}

	_, err = client.Index(). // preparedStatement
					Index(index). // statement.set(1,userid)
					Id(id).
					BodyJson(i).
					Do(context.Background()) // statement.execute()

	if err != nil {
		return err
	}

	return nil
}

func handlerCluster(w http.ResponseWriter, r *http.Request) {
	fmt.Println("Received one cluster request")
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization")

	if r.Method == "OPTIONS" {
		return
	}

	term := r.URL.Query().Get("term")
	query := elastic.NewRangeQuery(term).Gte(0.9)

	searchResult, err := readFromES(query, POST_INDEX)
	if err != nil {
		http.Error(w, "Failed to read from Elasticsearch", http.StatusInternalServerError)
		return
	}

	posts := getPostFromSearchResult(searchResult)
	js, err := json.Marshal(posts)
	if err != nil {
		http.Error(w, "Failed to parse post object", http.StatusInternalServerError)
		fmt.Printf("Failed to parse post object %v\n", err)
		return
	}
	w.Write(js)
}

package main

import (
	"context"
	//	"fmt"
	// here vision is rename of lib
	vision "cloud.google.com/go/vision/apiv1"
)

// Annotate an image file based on Cloud Vision API, return score and error if exists.
func annotate(uri string) (float32, error) {
	ctx := context.Background()

	client, err := vision.NewImageAnnotatorClient(ctx)
	if err != nil {
		return 0.0, err
	}

	defer client.Close()

	image := vision.NewImageFromURI(uri)
	// faceAnootations has the number of item base on how many face you want, where here set as 1
	faceAnnotations, err := client.DetectFaces(ctx, image, nil, 1)
	if err != nil {
		return 0.0, err
	}

	if len(faceAnnotations) == 0 {
		return 0.0, nil
	}
	return faceAnnotations[0].DetectionConfidence, nil
}

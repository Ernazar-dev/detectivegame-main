package main

import (
	"fmt"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"strings"
)

func processImage(srcPath, dstPath string, removeBg bool) error {
	file, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer file.Close()

	img, _, err := image.Decode(file)
	if err != nil {
		return err
	}

	bounds := img.Bounds()
	outImg := image.NewNRGBA(bounds)

	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			r, g, b, a := img.At(x, y).RGBA()
			r8, g8, b8, a8 := uint8(r>>8), uint8(g>>8), uint8(b>>8), uint8(a>>8)
			
			if removeBg && r8 > 245 && g8 > 245 && b8 > 245 {
				outImg.SetNRGBA(x, y, color.NRGBA{0, 0, 0, 0})
			} else {
				outImg.SetNRGBA(x, y, color.NRGBA{r8, g8, b8, a8})
			}
		}
	}

	outFile, err := os.Create(dstPath)
	if err != nil {
		return err
	}
	defer outFile.Close()

	return png.Encode(outFile, outImg)
}

func mains() {
	outDir := "backend/uploads/characters"
	os.MkdirAll(outDir, 0755)

	artifactsDir := "/Users/macbook/.gemini/antigravity/brain/4bc1da23-e681-4365-a597-087d2124cfa8"
	files, _ := os.ReadDir(artifactsDir)
	for _, f := range files {
		if strings.HasPrefix(f.Name(), "char_") && strings.HasSuffix(f.Name(), ".png") {
			parts := strings.Split(f.Name(), "_")
			// e.g., char_tech_genius_1776598424069.png -> char_tech_genius.png
			baseName := strings.Join(parts[:len(parts)-1], "_") + ".png"
			fmt.Println("Processing new:", f.Name(), "to", baseName)
			err := processImage(filepath.Join(artifactsDir, f.Name()), filepath.Join(outDir, baseName), true)
			if err != nil {
				fmt.Println("Error:", err)
			}
		}
	}

	// For the remaining images, we will just copy them from frontend/src/assets/library/ 
	// and also attempt to remove pure white background if they happen to have it.
	frontendDir := "frontend/src/assets/library"
	files, _ = os.ReadDir(frontendDir)
	for _, f := range files {
		if strings.HasPrefix(f.Name(), "char_") && strings.HasSuffix(f.Name(), ".png") {
			dstPath := filepath.Join(outDir, f.Name())
			if _, err := os.Stat(dstPath); os.IsNotExist(err) {
				fmt.Println("Copying existing:", f.Name())
				err := processImage(filepath.Join(frontendDir, f.Name()), dstPath, true)
				if err != nil {
					fmt.Println("Error:", err)
				}
			}
		}
	}
}

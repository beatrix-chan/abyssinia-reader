class PDFUtils {
  constructor(pdfReader) {
    this.pdfReader = pdfReader;
  }

  async createPDFFromImages(imagePaths) {
    try {
      // Use pdf-lib for creating PDFs
      const { PDFDocument } = PDFLib;
      const pdfDoc = await PDFDocument.create();

      for (const imagePath of imagePaths) {
        // Read image file
        const imageData = await this.pdfReader.ipcRenderer.invoke(
          "read-file",
          imagePath
        );
        if (!imageData.success) {
          console.error(`Failed to read image: ${imagePath}`);
          continue;
        }

        const imageBytes = Uint8Array.from(atob(imageData.data), (c) =>
          c.charCodeAt(0)
        );

        // Determine image type and embed
        let image;
        const imageType = this.getImageType(imagePath);

        if (imageType === "png") {
          image = await pdfDoc.embedPng(imageBytes);
        } else if (imageType === "jpg" || imageType === "jpeg") {
          image = await pdfDoc.embedJpg(imageBytes);
        } else {
          console.error(`Unsupported image type: ${imageType}`);
          continue;
        }

        // Create a page with image dimensions
        const imageDims = image.scale(1);
        const page = pdfDoc.addPage([imageDims.width, imageDims.height]);

        // Draw the image on the page
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: imageDims.width,
          height: imageDims.height,
        });
      }

      // Save the PDF
      const pdfBytes = await pdfDoc.save();

      // Show save dialog
      const saveResult = await this.pdfReader.ipcRenderer.invoke(
        "show-save-dialog",
        {
          filters: [{ name: "PDF Files", extensions: ["pdf"] }],
          defaultPath: "created-from-images.pdf",
        }
      );

      if (!saveResult.canceled && saveResult.filePath) {
        // Convert to base64 for saving
        const base64Data = btoa(String.fromCharCode(...pdfBytes));
        const writeResult = await this.pdfReader.ipcRenderer.invoke(
          "write-file",
          saveResult.filePath,
          base64Data
        );

        if (writeResult.success) {
          await this.pdfReader.ipcRenderer.invoke("show-message-box", {
            type: "info",
            title: "Success",
            message: "PDF created successfully!",
            detail: `PDF saved to: ${saveResult.filePath}`,
          });

          // Ask if user wants to open the created PDF
          const openResult = await this.pdfReader.ipcRenderer.invoke(
            "show-message-box",
            {
              type: "question",
              title: "Open PDF",
              message: "Would you like to open the created PDF?",
              buttons: ["Yes", "No"],
              defaultId: 0,
            }
          );

          if (openResult.response === 0) {
            await this.pdfReader.loadPDF(saveResult.filePath);
          }
        } else {
          throw new Error(writeResult.error);
        }
      }
    } catch (error) {
      console.error("Error creating PDF from images:", error);
      await this.pdfReader.ipcRenderer.invoke("show-message-box", {
        type: "error",
        title: "Error",
        message: "Failed to create PDF from images",
        detail: error.message,
      });
    }
  }

  getImageType(filePath) {
    const extension = filePath.toLowerCase().split(".").pop();
    return extension;
  }

  async rotatePage(pageNumber, rotation) {
    if (!this.pdfReader.currentPdf) return false;

    try {
      // This is a display-only rotation for now
      // To actually save rotated PDFs, we'd need to modify the PDF document
      this.pdfReader.rotation = (this.pdfReader.rotation + rotation) % 360;
      await this.pdfReader.renderCurrentPage();
      return true;
    } catch (error) {
      console.error("Error rotating page:", error);
      return false;
    }
  }

  async extractPagesAsImages(pageNumbers = null) {
    if (!this.pdfReader.currentPdf) return null;

    try {
      const images = [];
      const pagesToExtract =
        pageNumbers ||
        Array.from({ length: this.pdfReader.totalPages }, (_, i) => i + 1);

      for (const pageNum of pagesToExtract) {
        const page = await this.pdfReader.currentPdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 }); // Higher resolution

        // Create canvas
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render page to canvas
        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        // Convert to image data
        const imageData = canvas.toDataURL("image/png");
        images.push({
          pageNumber: pageNum,
          dataUrl: imageData,
          width: viewport.width,
          height: viewport.height,
        });
      }

      return images;
    } catch (error) {
      console.error("Error extracting pages as images:", error);
      return null;
    }
  }

  async savePagesAsImages(pageNumbers = null) {
    const images = await this.extractPagesAsImages(pageNumbers);
    if (!images) return;

    try {
      // Show save dialog for directory selection
      const saveResult = await this.pdfReader.ipcRenderer.invoke(
        "show-save-dialog",
        {
          title: "Save Pages as Images",
          defaultPath: "page",
          filters: [
            { name: "PNG Images", extensions: ["png"] },
            { name: "JPEG Images", extensions: ["jpg"] },
          ],
        }
      );

      if (!saveResult.canceled && saveResult.filePath) {
        const basePath = saveResult.filePath.replace(/\.[^/.]+$/, ""); // Remove extension
        const extension = saveResult.filePath.toLowerCase().endsWith(".jpg")
          ? "jpg"
          : "png";

        for (const image of images) {
          const fileName = `${basePath}_page_${image.pageNumber}.${extension}`;

          // Convert data URL to base64
          const base64Data = image.dataUrl.split(",")[1];

          const writeResult = await this.pdfReader.ipcRenderer.invoke(
            "write-file",
            fileName,
            base64Data
          );
          if (!writeResult.success) {
            console.error(
              `Failed to save page ${image.pageNumber}:`,
              writeResult.error
            );
          }
        }

        await this.pdfReader.ipcRenderer.invoke("show-message-box", {
          type: "info",
          title: "Success",
          message: `${images.length} page(s) saved as images successfully!`,
        });
      }
    } catch (error) {
      console.error("Error saving pages as images:", error);
      await this.pdfReader.ipcRenderer.invoke("show-message-box", {
        type: "error",
        title: "Error",
        message: "Failed to save pages as images",
        detail: error.message,
      });
    }
  }

  async cropPage(pageNumber, cropArea) {
    if (!this.pdfReader.currentPdf) {
      throw new Error("No PDF loaded");
    }

    try {
      const { PDFDocument } = PDFLib;
      const pdfDoc = await PDFDocument.create();

      // Get original PDF bytes
      const originalPdfBytes = await this.getOriginalPdfBytes();
      const originalPdf = await PDFDocument.load(originalPdfBytes);

      // Copy the page to crop
      const [copiedPage] = await pdfDoc.copyPages(originalPdf, [
        pageNumber - 1,
      ]);
      const page = pdfDoc.addPage(copiedPage);

      // Apply crop area (cropArea is in percentages)
      const { width, height } = page.getSize();
      const cropBox = {
        x: (cropArea.x / 100) * width,
        y:
          height -
          (cropArea.y / 100) * height -
          (cropArea.height / 100) * height,
        width: (cropArea.width / 100) * width,
        height: (cropArea.height / 100) * height,
      };

      page.setCropBox(cropBox.x, cropBox.y, cropBox.width, cropBox.height);

      // Save the cropped PDF
      const pdfBytes = await pdfDoc.save();

      // Show save dialog
      const saveResult = await this.pdfReader.ipcRenderer.invoke(
        "show-save-dialog",
        {
          filters: [{ name: "PDF Files", extensions: ["pdf"] }],
          defaultPath: `cropped_page_${pageNumber}.pdf`,
        }
      );

      if (!saveResult.canceled && saveResult.filePath) {
        const base64Data = btoa(String.fromCharCode(...pdfBytes));
        const writeResult = await this.pdfReader.ipcRenderer.invoke(
          "write-file",
          saveResult.filePath,
          base64Data
        );

        if (writeResult.success) {
          await this.pdfReader.ipcRenderer.invoke("show-message-box", {
            type: "info",
            title: "Success",
            message: "Page cropped and saved successfully!",
            detail: `Cropped page saved to: ${saveResult.filePath}`,
          });

          // Ask if user wants to open the cropped PDF
          const openResult = await this.pdfReader.ipcRenderer.invoke(
            "show-message-box",
            {
              type: "question",
              title: "Open Cropped PDF",
              message: "Would you like to open the cropped PDF?",
              buttons: ["Yes", "No"],
              defaultId: 0,
            }
          );

          if (openResult.response === 0) {
            await this.pdfReader.loadPDF(saveResult.filePath);
          }
          return true;
        } else {
          throw new Error(writeResult.error);
        }
      }

      return false;
    } catch (error) {
      console.error("Error cropping page:", error);
      throw error;
    }
  }

  async splitPDF(ranges) {
    if (!this.pdfReader.currentPdf) return false;

    try {
      // TODO: Implement PDF splitting
      // This would create new PDF documents from page ranges
      console.log("PDF splitting functionality to be implemented");
      return true;
    } catch (error) {
      console.error("Error splitting PDF:", error);
      return false;
    }
  }

  async saveReorganizedPDF(pageOrder) {
    if (!this.pdfReader.currentPdf) {
      throw new Error("No PDF loaded");
    }

    try {
      const { PDFDocument } = PDFLib;
      const pdfDoc = await PDFDocument.create();

      // Read the original PDF data
      const originalPdfBytes = await this.getOriginalPdfBytes();
      const originalPdf = await PDFDocument.load(originalPdfBytes);

      // Copy pages in the new order
      for (const pageNum of pageOrder) {
        if (pageNum > 0 && pageNum <= originalPdf.getPageCount()) {
          const [copiedPage] = await pdfDoc.copyPages(originalPdf, [
            pageNum - 1,
          ]);
          pdfDoc.addPage(copiedPage);
        }
      }

      // Save the new PDF
      const pdfBytes = await pdfDoc.save();

      // Show save dialog
      const saveResult = await this.pdfReader.ipcRenderer.invoke(
        "show-save-dialog",
        {
          filters: [{ name: "PDF Files", extensions: ["pdf"] }],
          defaultPath: "reorganized.pdf",
        }
      );

      if (!saveResult.canceled && saveResult.filePath) {
        const base64Data = btoa(String.fromCharCode(...pdfBytes));
        const writeResult = await this.pdfReader.ipcRenderer.invoke(
          "write-file",
          saveResult.filePath,
          base64Data
        );

        if (writeResult.success) {
          await this.pdfReader.ipcRenderer.invoke("show-message-box", {
            type: "info",
            title: "Success",
            message: "PDF reorganized and saved successfully!",
            detail: `Reorganized PDF saved to: ${saveResult.filePath}`,
          });

          // Ask if user wants to open the reorganized PDF
          const openResult = await this.pdfReader.ipcRenderer.invoke(
            "show-message-box",
            {
              type: "question",
              title: "Open Reorganized PDF",
              message: "Would you like to open the reorganized PDF?",
              buttons: ["Yes", "No"],
              defaultId: 0,
            }
          );

          if (openResult.response === 0) {
            await this.pdfReader.loadPDF(saveResult.filePath);
          }
          return true;
        } else {
          throw new Error(writeResult.error);
        }
      }
      return false;
    } catch (error) {
      console.error("Error saving reorganized PDF:", error);
      await this.pdfReader.ipcRenderer.invoke("show-message-box", {
        type: "error",
        title: "Error",
        message: "Failed to save reorganized PDF",
        detail: error.message,
      });
      return false;
    }
  }

  async getOriginalPdfBytes() {
    // This is a workaround to get the original PDF data
    // In a real implementation, you'd store the original PDF data when loading
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // For now, we'll create a new PDF with the current content
    // This is not ideal but works for the demo
    const { PDFDocument } = PDFLib;
    const pdfDoc = await PDFDocument.create();

    for (let i = 1; i <= this.pdfReader.totalPages; i++) {
      const page = await this.pdfReader.currentPdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: ctx,
        viewport: viewport,
      }).promise;

      const imageData = canvas.toDataURL("image/png");
      const imageBytes = Uint8Array.from(atob(imageData.split(",")[1]), (c) =>
        c.charCodeAt(0)
      );

      const image = await pdfDoc.embedPng(imageBytes);
      const pdfPage = pdfDoc.addPage([viewport.width, viewport.height]);

      pdfPage.drawImage(image, {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
      });
    }

    return await pdfDoc.save();
  }

  async mergePDFs(pdfPaths) {
    try {
      const { PDFDocument } = PDFLib;
      const mergedPdf = await PDFDocument.create();

      for (const pdfPath of pdfPaths) {
        // Read PDF file
        const pdfData = await this.pdfReader.ipcRenderer.invoke(
          "read-file",
          pdfPath
        );
        if (!pdfData.success) {
          console.error(`Failed to read PDF: ${pdfPath}`);
          continue;
        }

        const pdfBytes = Uint8Array.from(atob(pdfData.data), (c) =>
          c.charCodeAt(0)
        );
        const pdf = await PDFDocument.load(pdfBytes);

        // Copy all pages from this PDF
        const pageIndices = pdf.getPageIndices();
        const pages = await mergedPdf.copyPages(pdf, pageIndices);

        pages.forEach((page) => mergedPdf.addPage(page));
      }

      // Save the merged PDF
      const pdfBytes = await mergedPdf.save();

      // Show save dialog
      const saveResult = await this.pdfReader.ipcRenderer.invoke(
        "show-save-dialog",
        {
          filters: [{ name: "PDF Files", extensions: ["pdf"] }],
          defaultPath: "merged.pdf",
        }
      );

      if (!saveResult.canceled && saveResult.filePath) {
        const base64Data = btoa(String.fromCharCode(...pdfBytes));
        const writeResult = await this.pdfReader.ipcRenderer.invoke(
          "write-file",
          saveResult.filePath,
          base64Data
        );

        if (writeResult.success) {
          await this.pdfReader.ipcRenderer.invoke("show-message-box", {
            type: "info",
            title: "Success",
            message: "PDFs merged successfully!",
            detail: `Merged PDF saved to: ${saveResult.filePath}`,
          });
          return true;
        } else {
          throw new Error(writeResult.error);
        }
      }
    } catch (error) {
      console.error("Error merging PDFs:", error);
      await this.pdfReader.ipcRenderer.invoke("show-message-box", {
        type: "error",
        title: "Error",
        message: "Failed to merge PDFs",
        detail: error.message,
      });
      return false;
    }
  }

  async addPasswordProtection(password) {
    // TODO: Implement password protection using pdf-lib
    console.log("Password protection functionality to be implemented");
    return false;
  }

  async removePasswordProtection(password) {
    // TODO: Implement password removal
    console.log("Password removal functionality to be implemented");
    return false;
  }

  async optimizePDF() {
    // TODO: Implement PDF optimization (compression, etc.)
    console.log("PDF optimization functionality to be implemented");
    return false;
  }

  async addWatermark(watermarkText, options = {}) {
    if (!this.pdfReader.currentPdf) return false;

    try {
      // TODO: Implement watermark addition using pdf-lib
      console.log("Watermark functionality to be implemented");
      return true;
    } catch (error) {
      console.error("Error adding watermark:", error);
      return false;
    }
  }

  async extractText(pageNumber = null) {
    if (!this.pdfReader.currentPdf) return null;

    try {
      const extractedText = [];
      const pagesToProcess = pageNumber
        ? [pageNumber]
        : Array.from({ length: this.pdfReader.totalPages }, (_, i) => i + 1);

      for (const pageNum of pagesToProcess) {
        const page = await this.pdfReader.currentPdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        const pageText = textContent.items.map((item) => item.str).join(" ");
        extractedText.push({
          pageNumber: pageNum,
          text: pageText,
        });
      }

      return extractedText;
    } catch (error) {
      console.error("Error extracting text:", error);
      return null;
    }
  }

  async saveAsText() {
    const extractedText = await this.extractText();
    if (!extractedText) return;

    try {
      const saveResult = await this.pdfReader.ipcRenderer.invoke(
        "show-save-dialog",
        {
          filters: [{ name: "Text Files", extensions: ["txt"] }],
          defaultPath: "extracted-text.txt",
        }
      );

      if (!saveResult.canceled && saveResult.filePath) {
        const fullText = extractedText
          .map((page) => `--- Page ${page.pageNumber} ---\n${page.text}\n\n`)
          .join("");

        const base64Data = btoa(fullText);
        const writeResult = await this.pdfReader.ipcRenderer.invoke(
          "write-file",
          saveResult.filePath,
          base64Data
        );

        if (writeResult.success) {
          await this.pdfReader.ipcRenderer.invoke("show-message-box", {
            type: "info",
            title: "Success",
            message: "Text extracted and saved successfully!",
            detail: `Text saved to: ${saveResult.filePath}`,
          });
        } else {
          throw new Error(writeResult.error);
        }
      }
    } catch (error) {
      console.error("Error saving text:", error);
      await this.pdfReader.ipcRenderer.invoke("show-message-box", {
        type: "error",
        title: "Error",
        message: "Failed to save extracted text",
        detail: error.message,
      });
    }
  }
}

// Export for use in renderer.js
window.PDFUtils = PDFUtils;

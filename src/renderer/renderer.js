const { ipcRenderer } = require("electron");
const fs = require("fs");

class PDFReader {
  constructor() {
    console.log("🎯 PDFReader constructor called");
    this.currentPdf = null;
    this.currentPage = 1;
    this.totalPages = 0;
    this.zoom = 1.0;
    this.rotation = 0;
    this.activeTool = null;
    this.annotations = [];
    this.signatures = this.loadSignatures();

    // Tool settings
    this.highlighterColor = "#ffff00";
    this.highlighterThickness = 15;
    this.commentType = "comment";
    this.selectedStamp = "check";

    this.init();

    // Initialize annotation manager and PDF utils after DOM is ready
    setTimeout(() => {
      console.log("🔧 Initializing annotation manager and PDF utils");
      try {
        if (typeof AnnotationManager !== "undefined") {
          this.annotationManager = new AnnotationManager(this);
          console.log("✅ AnnotationManager initialized");
        } else {
          console.error("❌ AnnotationManager not found");
        }

        if (typeof PDFUtils !== "undefined") {
          this.pdfUtils = new PDFUtils(this);
          console.log("✅ PDFUtils initialized");
        } else {
          console.error("❌ PDFUtils not found");
        }

        // Make ipcRenderer available to utils
        this.ipcRenderer = ipcRenderer;
      } catch (error) {
        console.error("❌ Error initializing managers:", error);
      }
    }, 100);
  }

  init() {
    this.setupEventListeners();
    this.setupIpcListeners();
    // Don't show loading initially - show empty state instead
    this.hideLoading();
    this.showEmptyState();
  }

  setupEventListeners() {
    console.log("🎯 Setting up event listeners");
    // File operations
    const openPdfBtn = document.getElementById("open-pdf");
    const createPdfBtn = document.getElementById("create-pdf-from-images");

    if (openPdfBtn) {
      console.log("✅ Found open-pdf button, attaching click listener");
      openPdfBtn.addEventListener("click", () => {
        console.log("🖱️ Open PDF button clicked");
        this.openPDF();
      });
    } else {
      console.error("❌ open-pdf button not found");
    }

    if (createPdfBtn) {
      console.log(
        "✅ Found create-pdf-from-images button, attaching click listener"
      );
      createPdfBtn.addEventListener("click", () => {
        console.log("🖱️ Create PDF from images button clicked");
        this.createPDFFromImages();
      });
    } else {
      console.error("❌ create-pdf-from-images button not found");
    }

    // Tool selection
    document
      .getElementById("highlighter-tool")
      .addEventListener("click", () => this.selectTool("highlighter"));
    document
      .getElementById("comment-tool")
      .addEventListener("click", () => this.selectTool("comment"));
    document
      .getElementById("signature-tool")
      .addEventListener("click", () => this.selectTool("signature"));
    document
      .getElementById("stamp-tool")
      .addEventListener("click", () => this.selectTool("stamp"));
    document
      .getElementById("crop-tool")
      .addEventListener("click", () => this.selectTool("crop"));

    // Navigation
    document
      .getElementById("prev-page")
      .addEventListener("click", () => this.prevPage());
    document
      .getElementById("next-page")
      .addEventListener("click", () => this.nextPage());
    document
      .getElementById("current-page")
      .addEventListener("input", (e) =>
        this.goToPage(parseInt(e.target.value))
      );

    // Zoom controls
    document
      .getElementById("zoom-in")
      .addEventListener("click", () => this.zoomIn());
    document
      .getElementById("zoom-out")
      .addEventListener("click", () => this.zoomOut());
    document
      .getElementById("zoom-select")
      .addEventListener("change", (e) => this.setZoom(e.target.value));

    // Rotation
    document
      .getElementById("rotate-left")
      .addEventListener("click", () => this.rotateLeft());
    document
      .getElementById("rotate-right")
      .addEventListener("click", () => this.rotateRight());

    // Actions
    document
      .getElementById("print-pdf")
      .addEventListener("click", () => this.printPDF());
    document
      .getElementById("share-pdf")
      .addEventListener("click", () => this.sharePDF());

    // Sidebar
    document
      .getElementById("toggle-sidebar")
      .addEventListener("click", () => this.toggleSidebar());
    const sidebarTabs = document.querySelectorAll(".sidebar-tab");
    console.log(`📝 Found ${sidebarTabs.length} sidebar tabs`);
    sidebarTabs.forEach((tab) => {
      console.log(`✅ Setting up sidebar tab: ${tab.dataset.tab}`);
      tab.addEventListener("click", (e) => {
        const tabName = e.currentTarget.dataset.tab;
        console.log(`🖱️ Sidebar tab clicked: ${tabName}`);
        this.switchSidebarTab(tabName);
      });
    });

    // Tool options
    this.setupToolOptions();

    // Modals
    this.setupModals();

    // Keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  setupIpcListeners() {
    ipcRenderer.on("open-pdf", (event, filePath) => {
      this.loadPDF(filePath);
    });

    ipcRenderer.on("create-pdf-from-images", (event, imagePaths) => {
      this.createPDFFromImagePaths(imagePaths);
    });

    ipcRenderer.on("tool-selected", (event, tool) => {
      this.selectTool(tool);
    });

    ipcRenderer.on("print-pdf", () => {
      this.printPDF();
    });
  }

  setupToolOptions() {
    // Highlighter options
    document.querySelectorAll(".color-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        document
          .querySelectorAll(".color-btn")
          .forEach((b) => b.classList.remove("active"));
        e.target.classList.add("active");
        this.highlighterColor = e.target.dataset.color;

        // Update custom color picker to match
        document.getElementById("custom-color").value = e.target.dataset.color;
      });
    });

    // Custom color picker
    document.getElementById("custom-color").addEventListener("change", (e) => {
      document
        .querySelectorAll(".color-btn")
        .forEach((b) => b.classList.remove("active"));
      this.highlighterColor = e.target.value;
    });

    const thicknessSlider = document.getElementById("highlighter-thickness");
    const thicknessInput = document.getElementById("thickness-percentage");

    thicknessSlider.addEventListener("input", (e) => {
      const value = parseInt(e.target.value);
      this.highlighterThickness = value;
      thicknessInput.value = value;
    });

    thicknessInput.addEventListener("input", (e) => {
      const value = parseInt(e.target.value);
      if (value >= 10 && value <= 30) {
        this.highlighterThickness = value;
        thicknessSlider.value = value;
      }
    });

    // Comment type options - removed since we're simplifying comments
    // document.querySelectorAll('.comment-type-btn').forEach(btn => {
    //     btn.addEventListener('click', (e) => {
    //         document.querySelectorAll('.comment-type-btn').forEach(b => b.classList.remove('active'));
    //         e.target.classList.add('active');
    //         this.commentType = e.target.dataset.type;
    //     });
    // });

    // Stamp options
    document.querySelectorAll(".stamp-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        document
          .querySelectorAll(".stamp-btn")
          .forEach((b) => b.classList.remove("active"));
        e.target.classList.add("active");
        this.selectedStamp = e.target.dataset.stamp;
      });
    });

    // Signature options
    document
      .getElementById("create-signature")
      .addEventListener("click", () => {
        // Clear previous signature content when opening modal
        const canvas = document.getElementById("signature-canvas");
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const textInput = document.getElementById("signature-text");
        textInput.value = "";

        const fileInput = document.getElementById("signature-file");
        fileInput.value = "";

        this.showModal("signature-modal");
      });

    // Comment options
    document.getElementById("save-comment").addEventListener("click", () => {
      const commentText = document.getElementById("comment-text").value;
      if (this.annotationManager) {
        this.annotationManager.saveComment(commentText);
      }
    });

    // Page management options
    this.setupPageManagement();
  }

  setupModals() {
    // Modal close functionality
    document.querySelectorAll(".modal-close, [data-modal]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const modalId = e.target.dataset.modal || e.target.closest(".modal").id;
        this.hideModal(modalId);
      });
    });

    // Signature modal functionality
    this.setupSignatureModal();
  }

  setupSignatureModal() {
    // Signature tabs
    document.querySelectorAll(".signature-tab").forEach((tab) => {
      tab.addEventListener("click", (e) => {
        document
          .querySelectorAll(".signature-tab")
          .forEach((t) => t.classList.remove("active"));
        document
          .querySelectorAll(".signature-tab-content")
          .forEach((c) => c.classList.remove("active"));

        e.target.classList.add("active");
        document
          .getElementById(`${e.target.dataset.tab}-signature`)
          .classList.add("active");
      });
    });

    // Canvas drawing
    const canvas = document.getElementById("signature-canvas");
    const ctx = canvas.getContext("2d");
    let drawing = false;

    // Mouse events
    canvas.addEventListener("mousedown", (e) => {
      drawing = true;
      ctx.beginPath();
      const rect = canvas.getBoundingClientRect();
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    });

    canvas.addEventListener("mousemove", (e) => {
      if (drawing) {
        const rect = canvas.getBoundingClientRect();
        ctx.lineWidth = document.getElementById("pen-size").value;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#000";
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.stroke();
      }
    });

    canvas.addEventListener("mouseup", () => (drawing = false));
    canvas.addEventListener("mouseout", () => (drawing = false));

    // Touch events for stylus/draw support
    canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      drawing = true;
      ctx.beginPath();
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
    });

    canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      if (drawing) {
        const rect = canvas.getBoundingClientRect();
        ctx.lineWidth = document.getElementById("pen-size").value;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#000";
        const touch = e.touches[0];
        ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
        ctx.stroke();
      }
    });

    canvas.addEventListener("touchend", () => (drawing = false));

    // Clear signature
    document.getElementById("clear-signature").addEventListener("click", () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    // Save signature
    document.getElementById("save-signature").addEventListener("click", () => {
      this.saveSignature();
    });

    // Typed signature preview
    document.getElementById("signature-text").addEventListener("input", (e) => {
      const font = document.getElementById("signature-font").value;
      e.target.style.fontFamily = font;
    });

    document
      .getElementById("signature-font")
      .addEventListener("change", (e) => {
        const textInput = document.getElementById("signature-text");
        textInput.style.fontFamily = e.target.value;
      });
  }

  setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "o":
            e.preventDefault();
            this.openPDF();
            break;
          case "p":
            e.preventDefault();
            this.printPDF();
            break;
          case "h":
            e.preventDefault();
            this.selectTool("highlighter");
            break;
          case "m":
            e.preventDefault();
            this.selectTool("comment");
            break;
          case "s":
            if (!e.shiftKey) {
              e.preventDefault();
              this.selectTool("signature");
            }
            break;
          case "t":
            e.preventDefault();
            this.selectTool("stamp");
            break;
          case "z":
            e.preventDefault();
            if (this.annotationManager) {
              this.annotationManager.undoLastAnnotation();
            }
            break;
        }
      }

      // Page navigation
      if (e.key === "ArrowLeft" && this.currentPdf) {
        this.prevPage();
      } else if (e.key === "ArrowRight" && this.currentPdf) {
        this.nextPage();
      }
    });
  }

  async openPDF() {
    console.log("🗁️ openPDF called");
    try {
      const result = await ipcRenderer.invoke("show-open-dialog", {
        filters: [{ name: "PDF Files", extensions: ["pdf"] }],
        properties: ["openFile"],
      });

      console.log("📋 Open dialog result:", result);
      if (!result.canceled && result.filePaths.length > 0) {
        console.log("📡 Selected file:", result.filePaths[0]);
        await this.loadPDF(result.filePaths[0]);
      } else {
        console.log("❌ Open dialog was canceled or no files selected");
      }
    } catch (error) {
      console.error("❌ Error in openPDF:", error);
    }
  }

  async loadPDF(filePath) {
    this.showLoading();
    this.hideEmptyState();

    try {
      console.log("Loading PDF:", filePath);
      const fileData = await ipcRenderer.invoke("read-file", filePath);
      if (!fileData.success) {
        throw new Error(fileData.error);
      }

      console.log("PDF data read successfully");
      const pdfData = atob(fileData.data);
      const pdfBytes = new Uint8Array(pdfData.length);
      for (let i = 0; i < pdfData.length; i++) {
        pdfBytes[i] = pdfData.charCodeAt(i);
      }

      console.log("Loading PDF document...");
      this.currentPdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
      this.totalPages = this.currentPdf.numPages;
      this.currentPage = 1;

      console.log(`PDF loaded successfully. Total pages: ${this.totalPages}`);
      this.updateUI();
      await this.renderCurrentPage();
      await this.generateThumbnails();

      console.log("PDF rendering completed");
    } catch (error) {
      console.error("Error loading PDF:", error);
      this.showError(`Failed to load PDF file: ${error.message}`);
      this.showEmptyState();
    } finally {
      this.hideLoading();
    }
  }

  async renderCurrentPage() {
    if (!this.currentPdf) return;

    try {
      const page = await this.currentPdf.getPage(this.currentPage);
      const viewport = page.getViewport({
        scale: this.zoom,
        rotation: this.rotation,
      });

      // Clear previous content
      const pagesContainer = document.getElementById("pdf-pages");
      pagesContainer.innerHTML = "";

      // Create page container
      const pageDiv = document.createElement("div");
      pageDiv.className = "pdf-page";
      pageDiv.dataset.pageNumber = this.currentPage;

      // Create canvas
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      pageDiv.appendChild(canvas);
      pagesContainer.appendChild(pageDiv);

      // Render page
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      // Update page highlight in thumbnails
      this.updateThumbnailSelection();
    } catch (error) {
      console.error("Error rendering page:", error);
      this.showError("Failed to render page");
    }
  }

  async generateThumbnails() {
    const thumbnailsContainer = document.getElementById("thumbnails-container");
    thumbnailsContainer.innerHTML = "";

    for (let i = 1; i <= this.totalPages; i++) {
      try {
        const page = await this.currentPdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.2 });

        const thumbnailDiv = document.createElement("div");
        thumbnailDiv.className = "thumbnail";
        if (i === this.currentPage) {
          thumbnailDiv.classList.add("active");
        }

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        thumbnailDiv.appendChild(canvas);

        const info = document.createElement("div");
        info.className = "thumbnail-info";
        info.textContent = `Page ${i}`;
        thumbnailDiv.appendChild(info);

        thumbnailDiv.addEventListener("click", () => this.goToPage(i));

        thumbnailsContainer.appendChild(thumbnailDiv);

        // Render thumbnail
        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;
      } catch (error) {
        console.error(`Error generating thumbnail for page ${i}:`, error);
      }
    }
  }

  updateThumbnailSelection() {
    document.querySelectorAll(".thumbnail").forEach((thumb, index) => {
      thumb.classList.toggle("active", index + 1 === this.currentPage);
    });
  }

  selectTool(tool) {
    // Deactivate all tools
    document
      .querySelectorAll(".tool-btn")
      .forEach((btn) => btn.classList.remove("active"));
    document
      .querySelectorAll(".tool-panel")
      .forEach((panel) => panel.classList.remove("active"));

    if (this.activeTool === tool) {
      // Deselect current tool
      this.activeTool = null;
      this.hideToolOptions();
    } else {
      // Select new tool
      this.activeTool = tool;
      if (tool !== "crop") {
        document.getElementById(`${tool}-tool`).classList.add("active");
        document.getElementById(`${tool}-options`).classList.add("active");
        this.showToolOptions();
      } else {
        document.getElementById("crop-tool").classList.add("active");
        this.initCropTool();
      }
    }

    this.updateCursor();
  }

  showToolOptions() {
    document.getElementById("tool-options").style.display = "block";
  }

  hideToolOptions() {
    document.getElementById("tool-options").style.display = "none";
  }

  updateCursor() {
    const viewer = document.getElementById("pdf-viewer");
    if (this.activeTool === "crop") {
      viewer.style.cursor = "crosshair";
    } else if (this.activeTool) {
      viewer.style.cursor = "crosshair";
    } else {
      viewer.style.cursor = "default";
    }
  }

  // Crop tool functionality
  initCropTool() {
    if (!this.currentPdf) return;

    this.cropSelection = null;
    this.isDraggingCrop = false;
    this.isResizingCrop = false;
    this.cropStartPoint = null;

    // Create crop overlay
    let cropOverlay = document.getElementById("crop-overlay");
    if (!cropOverlay) {
      cropOverlay = document.createElement("div");
      cropOverlay.id = "crop-overlay";
      cropOverlay.className = "crop-overlay";
      document.querySelector(".pdf-viewer").appendChild(cropOverlay);
    }

    // Add event listeners to PDF viewer for crop selection
    const pdfViewer = document.getElementById("pdf-viewer");
    pdfViewer.addEventListener("mousedown", (e) => this.handleCropMouseDown(e));
    pdfViewer.addEventListener("mousemove", (e) => this.handleCropMouseMove(e));
    pdfViewer.addEventListener("mouseup", (e) => this.handleCropMouseUp(e));
  }

  handleCropMouseDown(e) {
    if (this.activeTool !== "crop") return;

    const pdfPage = e.target.closest(".pdf-page");
    if (!pdfPage) return;

    const rect = pdfPage.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Check if clicking on existing crop selection
    const cropSelection = document.querySelector(".crop-selection");
    if (cropSelection) {
      const cropRect = cropSelection.getBoundingClientRect();
      const pageRect = pdfPage.getBoundingClientRect();

      const relativeX = e.clientX - pageRect.left;
      const relativeY = e.clientY - pageRect.top;

      if (
        relativeX >= cropRect.left - pageRect.left &&
        relativeX <= cropRect.right - pageRect.left &&
        relativeY >= cropRect.top - pageRect.top &&
        relativeY <= cropRect.bottom - pageRect.top
      ) {
        this.isDraggingCrop = true;
        this.cropStartPoint = { x: relativeX, y: relativeY };
        return;
      } else {
        // Remove existing selection and start new one
        cropSelection.remove();
      }
    }

    // Start new crop selection
    this.createCropSelection(pdfPage, x, y);
    this.isDraggingCrop = false;
    this.isResizingCrop = true;
    this.cropStartPoint = { x, y };
  }

  handleCropMouseMove(e) {
    if (this.activeTool !== "crop") return;

    const pdfPage = e.target.closest(".pdf-page");
    if (!pdfPage) return;

    const cropSelection = document.querySelector(".crop-selection");
    if (!cropSelection) return;

    const rect = pdfPage.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (this.isResizingCrop && this.cropStartPoint) {
      // Update crop selection size
      const width = Math.abs(x - this.cropStartPoint.x);
      const height = Math.abs(y - this.cropStartPoint.y);
      const left = Math.min(x, this.cropStartPoint.x);
      const top = Math.min(y, this.cropStartPoint.y);

      cropSelection.style.left = `${left}%`;
      cropSelection.style.top = `${top}%`;
      cropSelection.style.width = `${width}%`;
      cropSelection.style.height = `${height}%`;
    } else if (this.isDraggingCrop) {
      // Move crop selection
      const relativeX = e.clientX - rect.left;
      const relativeY = e.clientY - rect.top;

      const deltaX = relativeX - this.cropStartPoint.x;
      const deltaY = relativeY - this.cropStartPoint.y;

      const currentLeft = parseFloat(cropSelection.style.left);
      const currentTop = parseFloat(cropSelection.style.top);
      const width = parseFloat(cropSelection.style.width);
      const height = parseFloat(cropSelection.style.height);

      const newLeft = Math.max(
        0,
        Math.min(100 - width, currentLeft + (deltaX / rect.width) * 100)
      );
      const newTop = Math.max(
        0,
        Math.min(100 - height, currentTop + (deltaY / rect.height) * 100)
      );

      cropSelection.style.left = `${newLeft}%`;
      cropSelection.style.top = `${newTop}%`;

      this.cropStartPoint = { x: relativeX, y: relativeY };
    }
  }

  handleCropMouseUp(e) {
    if (this.activeTool !== "crop") return;

    this.isDraggingCrop = false;
    this.isResizingCrop = false;
    this.cropStartPoint = null;

    // Show crop actions if we have a valid selection
    const cropSelection = document.querySelector(".crop-selection");
    if (cropSelection) {
      const width = parseFloat(cropSelection.style.width);
      const height = parseFloat(cropSelection.style.height);

      if (width > 5 && height > 5) {
        this.showCropActions(cropSelection);
      }
    }
  }

  createCropSelection(pdfPage, x, y) {
    const cropSelection = document.createElement("div");
    cropSelection.className = "crop-selection";
    cropSelection.style.position = "absolute";
    cropSelection.style.left = `${x}%`;
    cropSelection.style.top = `${y}%`;
    cropSelection.style.width = "0%";
    cropSelection.style.height = "0%";
    cropSelection.style.border = "2px dashed #007bff";
    cropSelection.style.background = "rgba(0, 123, 255, 0.1)";
    cropSelection.style.pointerEvents = "all";
    cropSelection.style.cursor = "move";
    cropSelection.style.zIndex = "1000";

    pdfPage.appendChild(cropSelection);
  }

  showCropActions(cropSelection) {
    // Remove existing actions
    const existingActions = document.querySelector(".crop-actions");
    if (existingActions) {
      existingActions.remove();
    }

    const actions = document.createElement("div");
    actions.className = "crop-actions";
    actions.style.position = "absolute";
    actions.style.top = "-40px";
    actions.style.left = "50%";
    actions.style.transform = "translateX(-50%)";
    actions.style.display = "flex";
    actions.style.gap = "5px";
    actions.style.background = "#fff";
    actions.style.padding = "5px";
    actions.style.borderRadius = "4px";
    actions.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.15)";
    actions.style.zIndex = "1001";

    const applyCropBtn = document.createElement("button");
    applyCropBtn.className = "apply-crop";
    applyCropBtn.innerHTML = '<i class="fas fa-check"></i> Crop';
    applyCropBtn.style.background = "#28a745";
    applyCropBtn.style.color = "white";
    applyCropBtn.style.border = "none";
    applyCropBtn.style.padding = "4px 8px";
    applyCropBtn.style.fontSize = "12px";
    applyCropBtn.style.borderRadius = "3px";
    applyCropBtn.style.cursor = "pointer";
    applyCropBtn.addEventListener("click", () => this.applyCrop());

    const cancelCropBtn = document.createElement("button");
    cancelCropBtn.className = "cancel-crop";
    cancelCropBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
    cancelCropBtn.style.background = "#dc3545";
    cancelCropBtn.style.color = "white";
    cancelCropBtn.style.border = "none";
    cancelCropBtn.style.padding = "4px 8px";
    cancelCropBtn.style.fontSize = "12px";
    cancelCropBtn.style.borderRadius = "3px";
    cancelCropBtn.style.cursor = "pointer";
    cancelCropBtn.addEventListener("click", () => this.cancelCrop());

    actions.appendChild(applyCropBtn);
    actions.appendChild(cancelCropBtn);
    cropSelection.appendChild(actions);
  }

  async applyCrop() {
    const cropSelection = document.querySelector(".crop-selection");
    if (!cropSelection || !this.pdfUtils) return;

    const cropArea = {
      x: parseFloat(cropSelection.style.left),
      y: parseFloat(cropSelection.style.top),
      width: parseFloat(cropSelection.style.width),
      height: parseFloat(cropSelection.style.height),
    };

    try {
      this.showLoading();
      await this.pdfUtils.cropPage(this.currentPage, cropArea);
      this.cancelCrop();
    } catch (error) {
      this.showError("Failed to crop page: " + error.message);
    } finally {
      this.hideLoading();
    }
  }

  cancelCrop() {
    const cropSelection = document.querySelector(".crop-selection");
    if (cropSelection) {
      cropSelection.remove();
    }

    // Deselect crop tool
    this.selectTool(null);
  }

  // Navigation methods
  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updateUI();
      this.renderCurrentPage();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updateUI();
      this.renderCurrentPage();
    }
  }

  goToPage(pageNum) {
    if (pageNum >= 1 && pageNum <= this.totalPages) {
      this.currentPage = pageNum;
      this.updateUI();
      this.renderCurrentPage();
    }
  }

  // Zoom methods
  zoomIn() {
    this.zoom = Math.min(this.zoom * 1.25, 3.0);
    this.updateZoomUI();
    this.renderCurrentPage();
  }

  zoomOut() {
    this.zoom = Math.max(this.zoom / 1.25, 0.25);
    this.updateZoomUI();
    this.renderCurrentPage();
  }

  setZoom(value) {
    if (value === "fit-width" || value === "fit-page") {
      // TODO: Implement fit-to-width and fit-to-page
      return;
    }
    this.zoom = parseFloat(value);
    this.renderCurrentPage();
  }

  updateZoomUI() {
    const zoomSelect = document.getElementById("zoom-select");
    const zoomValue = Math.round(this.zoom * 100) / 100;

    // Try to find matching option
    const matchingOption = Array.from(zoomSelect.options).find(
      (option) => parseFloat(option.value) === zoomValue
    );

    if (matchingOption) {
      zoomSelect.value = matchingOption.value;
    } else {
      // Add custom zoom level if needed
      const customOption = document.createElement("option");
      customOption.value = zoomValue;
      customOption.textContent = `${Math.round(zoomValue * 100)}%`;
      zoomSelect.appendChild(customOption);
      zoomSelect.value = zoomValue;
    }
  }

  // Rotation methods
  rotateLeft() {
    if (this.annotationManager) {
      // Save annotations state before rotation
      const annotationsState = this.annotationManager.saveAnnotationsState();
      this.rotation = (this.rotation - 90) % 360;
      this.renderCurrentPage();
      // Restore annotations after rotation
      setTimeout(() => {
        this.annotationManager.restoreAnnotationsState(annotationsState);
      }, 100);
    } else {
      this.rotation = (this.rotation - 90) % 360;
      this.renderCurrentPage();
    }
  }

  rotateRight() {
    if (this.annotationManager) {
      // Save annotations state before rotation
      const annotationsState = this.annotationManager.saveAnnotationsState();
      this.rotation = (this.rotation + 90) % 360;
      this.renderCurrentPage();
      // Restore annotations after rotation
      setTimeout(() => {
        this.annotationManager.restoreAnnotationsState(annotationsState);
      }, 100);
    } else {
      this.rotation = (this.rotation + 90) % 360;
      this.renderCurrentPage();
    }
  }

  // Print functionality
  printPDF() {
    if (!this.currentPdf) {
      this.showError("No PDF loaded to print");
      return;
    }

    window.print();
  }

  // Share functionality
  async sharePDF() {
    if (!this.currentPdf) {
      this.showError("No PDF loaded to share");
      return;
    }

    // TODO: Implement sharing functionality
    console.log("Share PDF functionality to be implemented");
  }

  // Create PDF from images
  async createPDFFromImages() {
    const result = await ipcRenderer.invoke("show-open-dialog", {
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
      properties: ["openFiles", "multiSelections"],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      await this.createPDFFromImagePaths(result.filePaths);
    }
  }

  async createPDFFromImagePaths(imagePaths) {
    if (this.pdfUtils) {
      await this.pdfUtils.createPDFFromImages(imagePaths);
    } else {
      this.showError("PDF utilities not initialized yet");
    }
  }

  // Sidebar functionality
  toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.toggle("collapsed");
  }

  switchSidebarTab(tabName) {
    console.log(`🔄 switchSidebarTab called with: ${tabName}`);
    // Update tab buttons
    const tabButtons = document.querySelectorAll(".sidebar-tab");
    console.log(`📝 Found ${tabButtons.length} tab buttons`);
    tabButtons.forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.tab === tabName);
    });

    // Update tab content
    const tabContents = document.querySelectorAll(".tab-content");
    console.log(`📝 Found ${tabContents.length} tab contents`);
    tabContents.forEach((content) => {
      const isActive = content.id === `${tabName}-tab`;
      console.log(
        `📋 Tab content: ${content.id}, should be active: ${isActive}`
      );
      content.classList.toggle("active", isActive);
    });
  }

  // Signature functionality
  saveSignature() {
    const activeTab = document.querySelector(".signature-tab.active").dataset
      .tab;
    let signatureData = null;

    switch (activeTab) {
      case "draw":
        const canvas = document.getElementById("signature-canvas");
        signatureData = {
          type: "draw",
          data: canvas.toDataURL(),
        };
        break;
      case "type":
        const text = document.getElementById("signature-text").value;
        const font = document.getElementById("signature-font").value;
        if (text.trim()) {
          signatureData = {
            type: "type",
            text: text.trim(),
            font: font,
          };
        }
        break;
      case "upload":
        const fileInput = document.getElementById("signature-file");
        if (fileInput.files.length > 0) {
          const file = fileInput.files[0];
          const reader = new FileReader();
          reader.onload = (e) => {
            const uploadedSignature = {
              type: "upload",
              data: e.target.result,
            };
            this.signatures.push({
              id: Date.now(),
              ...uploadedSignature,
            });
            this.saveSignaturesToStorage();
            this.updateSavedSignatures();
            this.hideModal("signature-modal");
          };
          reader.readAsDataURL(file);
        }
        return; // Exit early for file upload
    }

    if (signatureData) {
      this.signatures.push({
        id: Date.now(),
        ...signatureData,
      });
      this.saveSignaturesToStorage();
      this.updateSavedSignatures();
      this.hideModal("signature-modal");
    }
  }

  getSelectedSignature() {
    // Return the selected signature or the last one if none selected
    if (
      this.selectedSignatureIndex !== undefined &&
      this.signatures[this.selectedSignatureIndex]
    ) {
      return this.signatures[this.selectedSignatureIndex];
    }
    return this.signatures.length > 0
      ? this.signatures[this.signatures.length - 1]
      : null;
  }

  loadSignatures() {
    try {
      const saved = localStorage.getItem("pdfReader_signatures");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  saveSignaturesToStorage() {
    localStorage.setItem(
      "pdfReader_signatures",
      JSON.stringify(this.signatures)
    );
  }

  updateSavedSignatures() {
    const container = document.getElementById("saved-signatures");
    container.innerHTML = "";

    this.signatures.forEach((sig, index) => {
      const sigDiv = document.createElement("div");
      sigDiv.className = "saved-signature";
      // Remove inline styles that conflict with CSS - rely on .saved-signature CSS class

      if (sig.type === "draw") {
        sigDiv.style.backgroundImage = `url(${sig.data})`;
        sigDiv.style.backgroundSize = "contain";
        sigDiv.style.backgroundRepeat = "no-repeat";
        sigDiv.style.backgroundPosition = "center";
      } else if (sig.type === "type") {
        sigDiv.style.fontFamily = sig.font || "cursive";
        sigDiv.textContent = sig.text;
        sigDiv.style.fontSize = "14px";
        sigDiv.style.color = "#000";
      } else if (sig.type === "upload") {
        const img = document.createElement("img");
        img.src = sig.data;
        img.style.maxWidth = "100%";
        img.style.maxHeight = "100%";
        sigDiv.appendChild(img);
      }

      // Add delete button
      const deleteBtn = document.createElement("button");
      deleteBtn.innerHTML = "×";
      deleteBtn.style.position = "absolute";
      deleteBtn.style.top = "-5px";
      deleteBtn.style.right = "-5px";
      deleteBtn.style.width = "20px";
      deleteBtn.style.height = "20px";
      deleteBtn.style.border = "none";
      deleteBtn.style.borderRadius = "50%";
      deleteBtn.style.backgroundColor = "#ff4444";
      deleteBtn.style.color = "white";
      deleteBtn.style.cursor = "pointer";
      deleteBtn.style.fontSize = "14px";
      deleteBtn.style.fontWeight = "bold";

      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.signatures.splice(index, 1);
        this.saveSignaturesToStorage();
        this.updateSavedSignatures();
      });

      sigDiv.appendChild(deleteBtn);

      // Add click handler to select this signature
      sigDiv.addEventListener("click", () => {
        // Remove active class from all signatures
        container
          .querySelectorAll(".saved-signature")
          .forEach((s) => s.classList.remove("active"));
        // Add active class to clicked signature
        sigDiv.classList.add("active");
        // Store selected signature index
        this.selectedSignatureIndex = index;
      });

      container.appendChild(sigDiv);
    });
  }

  // Modal functionality
  showModal(modalId) {
    document.getElementById(modalId).classList.add("show");
  }

  hideModal(modalId) {
    document.getElementById(modalId).classList.remove("show");
  }

  // UI update methods
  updateUI() {
    document.getElementById("current-page").value = this.currentPage;
    document.getElementById("total-pages").textContent = this.totalPages;

    document.getElementById("prev-page").disabled = this.currentPage <= 1;
    document.getElementById("next-page").disabled =
      this.currentPage >= this.totalPages;
  }

  // Loading and error states
  showLoading() {
    document.getElementById("loading-overlay").style.display = "flex";
  }

  hideLoading() {
    document.getElementById("loading-overlay").style.display = "none";
  }

  showEmptyState() {
    document.getElementById("empty-state").style.display = "flex";
  }

  hideEmptyState() {
    document.getElementById("empty-state").style.display = "none";
  }

  showError(message) {
    // TODO: Implement proper error display
    console.error(message);
    alert(message);
  }

  // Page Management functionality
  setupPageManagement() {
    // Dropdown functionality
    const dropdown = document.getElementById("pages-dropdown");
    const dropdownContent = document.getElementById("pages-dropdown-content");

    dropdown.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.parentElement.classList.toggle("show");
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", () => {
      dropdown.parentElement.classList.remove("show");
    });

    // Page management actions
    document
      .getElementById("reorganize-pages")
      .addEventListener("click", () => {
        this.openReorganizeModal();
        dropdown.parentElement.classList.remove("show");
      });

    document.getElementById("export-images").addEventListener("click", () => {
      if (this.pdfUtils) {
        this.pdfUtils.savePagesAsImages();
      }
      dropdown.parentElement.classList.remove("show");
    });

    document.getElementById("extract-text").addEventListener("click", () => {
      if (this.pdfUtils) {
        this.pdfUtils.saveAsText();
      }
      dropdown.parentElement.classList.remove("show");
    });

    // Reorganization modal controls
    document
      .getElementById("select-all-pages")
      .addEventListener("click", () => {
        this.selectAllPages();
      });

    document
      .getElementById("select-none-pages")
      .addEventListener("click", () => {
        this.selectNonePages();
      });

    document.getElementById("reverse-pages").addEventListener("click", () => {
      this.reversePages();
    });

    document.getElementById("delete-selected").addEventListener("click", () => {
      this.deleteSelectedPages();
    });

    document
      .getElementById("duplicate-selected")
      .addEventListener("click", () => {
        this.duplicateSelectedPages();
      });

    document
      .getElementById("apply-reorganization")
      .addEventListener("click", () => {
        this.applyReorganization();
      });

    // IPC listeners for menu actions
    ipcRenderer.on("export-as-images", () => {
      if (this.pdfUtils) {
        this.pdfUtils.savePagesAsImages();
      }
    });

    ipcRenderer.on("extract-text", () => {
      if (this.pdfUtils) {
        this.pdfUtils.saveAsText();
      }
    });
  }

  async openReorganizeModal() {
    if (!this.currentPdf) {
      this.showError("No PDF loaded");
      return;
    }

    this.showModal("reorganize-modal");
    await this.generateOrganizerPages();
  }

  async generateOrganizerPages() {
    const organizer = document.getElementById("page-organizer");
    organizer.innerHTML = "";

    for (let i = 1; i <= this.totalPages; i++) {
      try {
        const page = await this.currentPdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.15 });

        const pageDiv = document.createElement("div");
        pageDiv.className = "organizer-page";
        pageDiv.dataset.pageNumber = i;
        pageDiv.draggable = true;

        // Page number badge
        const pageNumber = document.createElement("div");
        pageNumber.className = "organizer-page-number";
        pageNumber.textContent = i;
        pageDiv.appendChild(pageNumber);

        // Checkbox
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "organizer-page-checkbox";
        checkbox.addEventListener("click", (e) => {
          e.stopPropagation();
          pageDiv.classList.toggle("selected", checkbox.checked);
        });
        pageDiv.appendChild(checkbox);

        // Canvas for page preview
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        pageDiv.appendChild(canvas);

        // Page info
        const info = document.createElement("div");
        info.className = "organizer-page-info";
        info.textContent = `Page ${i}`;
        pageDiv.appendChild(info);

        // Drag and drop events
        pageDiv.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/plain", i.toString());
          pageDiv.classList.add("dragging");
        });

        pageDiv.addEventListener("dragend", () => {
          pageDiv.classList.remove("dragging");
        });

        pageDiv.addEventListener("dragover", (e) => {
          e.preventDefault();
        });

        pageDiv.addEventListener("drop", (e) => {
          e.preventDefault();
          const draggedPageNum = parseInt(e.dataTransfer.getData("text/plain"));
          const targetPageNum = parseInt(pageDiv.dataset.pageNumber);

          if (draggedPageNum !== targetPageNum) {
            this.reorderPages(draggedPageNum, targetPageNum);
          }
        });

        // Click to select
        pageDiv.addEventListener("click", (e) => {
          if (e.target !== checkbox) {
            checkbox.checked = !checkbox.checked;
            pageDiv.classList.toggle("selected", checkbox.checked);
          }
        });

        organizer.appendChild(pageDiv);

        // Render thumbnail
        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;
      } catch (error) {
        console.error(`Error generating organizer page ${i}:`, error);
      }
    }
  }

  selectAllPages() {
    const pages = document.querySelectorAll(".organizer-page");
    pages.forEach((page) => {
      const checkbox = page.querySelector(".organizer-page-checkbox");
      checkbox.checked = true;
      page.classList.add("selected");
    });
  }

  selectNonePages() {
    const pages = document.querySelectorAll(".organizer-page");
    pages.forEach((page) => {
      const checkbox = page.querySelector(".organizer-page-checkbox");
      checkbox.checked = false;
      page.classList.remove("selected");
    });
  }

  reversePages() {
    const organizer = document.getElementById("page-organizer");
    const pages = Array.from(organizer.children);

    // Reverse the order
    pages.reverse();

    // Clear and re-append in new order
    organizer.innerHTML = "";
    pages.forEach((page, index) => {
      page.dataset.pageNumber = index + 1;
      page.querySelector(".organizer-page-number").textContent = index + 1;
      page.querySelector(".organizer-page-info").textContent = `Page ${
        index + 1
      }`;
      organizer.appendChild(page);
    });
  }

  deleteSelectedPages() {
    const selectedPages = document.querySelectorAll(".organizer-page.selected");
    if (selectedPages.length === 0) {
      this.showError("No pages selected");
      return;
    }

    const confirmed = confirm(
      `Delete ${selectedPages.length} selected page(s)?`
    );
    if (confirmed) {
      selectedPages.forEach((page) => page.remove());
      this.renumberOrganizerPages();
    }
  }

  duplicateSelectedPages() {
    const selectedPages = document.querySelectorAll(".organizer-page.selected");
    if (selectedPages.length === 0) {
      this.showError("No pages selected");
      return;
    }

    const organizer = document.getElementById("page-organizer");
    selectedPages.forEach((page) => {
      const clone = page.cloneNode(true);
      const checkbox = clone.querySelector(".organizer-page-checkbox");
      checkbox.checked = false;
      clone.classList.remove("selected");

      // Re-attach event listeners
      this.attachOrganizerPageEvents(clone);

      // Insert after the original
      page.parentNode.insertBefore(clone, page.nextSibling);
    });

    this.renumberOrganizerPages();
  }

  attachOrganizerPageEvents(pageDiv) {
    const checkbox = pageDiv.querySelector(".organizer-page-checkbox");
    const pageNumber = parseInt(pageDiv.dataset.pageNumber);

    // Checkbox event
    checkbox.addEventListener("click", (e) => {
      e.stopPropagation();
      pageDiv.classList.toggle("selected", checkbox.checked);
    });

    // Drag events
    pageDiv.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", pageNumber.toString());
      pageDiv.classList.add("dragging");
    });

    pageDiv.addEventListener("dragend", () => {
      pageDiv.classList.remove("dragging");
    });

    // Click to select
    pageDiv.addEventListener("click", (e) => {
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
        pageDiv.classList.toggle("selected", checkbox.checked);
      }
    });
  }

  renumberOrganizerPages() {
    const pages = document.querySelectorAll(".organizer-page");
    pages.forEach((page, index) => {
      const newPageNum = index + 1;
      page.dataset.pageNumber = newPageNum;
      page.querySelector(".organizer-page-number").textContent = newPageNum;
      page.querySelector(
        ".organizer-page-info"
      ).textContent = `Page ${newPageNum}`;
    });
  }

  reorderPages(fromIndex, toIndex) {
    const organizer = document.getElementById("page-organizer");
    const pages = Array.from(organizer.children);

    // Move the page
    const movedPage = pages.splice(fromIndex - 1, 1)[0];
    pages.splice(toIndex - 1, 0, movedPage);

    // Clear and re-append in new order
    organizer.innerHTML = "";
    pages.forEach((page) => organizer.appendChild(page));

    this.renumberOrganizerPages();
  }

  async applyReorganization() {
    try {
      // Get the current page order from the organizer
      const organizerPages = document.querySelectorAll(".organizer-page");
      const pageOrder = Array.from(organizerPages).map((page) => {
        const originalPageNum = parseInt(
          page.querySelector(".organizer-page-number").textContent
        );
        return originalPageNum;
      });

      if (pageOrder.length === 0) {
        this.showError("No pages to reorganize");
        return;
      }

      this.showLoading();

      // Use PDFUtils to save the reorganized PDF
      const success = await this.pdfUtils.saveReorganizedPDF(pageOrder);

      if (success) {
        this.hideModal("reorganize-modal");
      }
    } catch (error) {
      console.error("Error applying reorganization:", error);
      this.showError("Failed to reorganize PDF: " + error.message);
    } finally {
      this.hideLoading();
    }
  }
}

// Initialize the PDF reader when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  window.pdfReader = new PDFReader();
});

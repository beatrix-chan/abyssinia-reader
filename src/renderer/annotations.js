class AnnotationManager {
  constructor(pdfReader) {
    this.pdfReader = pdfReader;
    this.annotations = new Map(); // pageNumber -> annotations[]
    this.activeAnnotation = null;
    this.isDrawing = false;
    this.lastPoint = null;

    this.setupAnnotationEvents();
  }

  setupAnnotationEvents() {
    const pdfViewer = document.getElementById("pdf-viewer");

    // Mouse events for drawing annotations
    pdfViewer.addEventListener("mousedown", (e) => this.handleMouseDown(e));
    pdfViewer.addEventListener("mousemove", (e) => this.handleMouseMove(e));
    pdfViewer.addEventListener("mouseup", (e) => this.handleMouseUp(e));

    // Keyboard events for straight line highlighting
    document.addEventListener("keydown", (e) => {
      if (e.key === "Shift") {
        this.shiftPressed = true;
      }
      if (e.key === "Control" || e.key === "Meta") {
        this.ctrlPressed = true;
      }
    });

    document.addEventListener("keyup", (e) => {
      if (e.key === "Shift") {
        this.shiftPressed = false;
      }
      if (e.key === "Control" || e.key === "Meta") {
        this.ctrlPressed = false;
      }
    });
  }

  handleMouseDown(e) {
    if (!this.pdfReader.activeTool) return;

    const pageElement = e.target.closest(".pdf-page");
    if (!pageElement) return;

    e.preventDefault();
    this.isDrawing = true;

    const rect = pageElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pageNumber = parseInt(pageElement.dataset.pageNumber);

    this.startAnnotation(x, y, pageNumber, pageElement);
  }

  handleMouseMove(e) {
    if (!this.isDrawing || !this.activeAnnotation) return;

    const pageElement = e.target.closest(".pdf-page");
    if (!pageElement) return;

    e.preventDefault();

    const rect = pageElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.updateAnnotation(x, y);
  }

  handleMouseUp(e) {
    if (!this.isDrawing) return;

    this.isDrawing = false;

    if (this.activeAnnotation) {
      this.finalizeAnnotation();
    }
  }

  startAnnotation(x, y, pageNumber, pageElement) {
    const tool = this.pdfReader.activeTool;

    switch (tool) {
      case "highlighter":
        this.startHighlight(x, y, pageNumber, pageElement);
        break;
      case "comment":
        this.addComment(x, y, pageNumber, pageElement);
        break;
      case "stamp":
        this.addStamp(x, y, pageNumber, pageElement);
        break;
      case "signature":
        this.addSignature(x, y, pageNumber, pageElement);
        break;
    }
  }

  startHighlight(x, y, pageNumber, pageElement) {
    // Create a new canvas for this specific highlight to prevent overlap issues
    const highlightCanvas = document.createElement("canvas");
    highlightCanvas.className = "highlight-canvas";
    highlightCanvas.style.position = "absolute";
    highlightCanvas.style.top = "0";
    highlightCanvas.style.left = "0";
    highlightCanvas.style.pointerEvents = "none";
    highlightCanvas.style.zIndex = "10";

    // Match the size of the PDF canvas
    const pdfCanvas = pageElement.querySelector("canvas");
    highlightCanvas.width = pdfCanvas.width;
    highlightCanvas.height = pdfCanvas.height;
    highlightCanvas.style.width =
      pdfCanvas.style.width || `${pdfCanvas.width}px`;
    highlightCanvas.style.height =
      pdfCanvas.style.height || `${pdfCanvas.height}px`;

    pageElement.style.position = "relative";
    pageElement.appendChild(highlightCanvas);

    const ctx = highlightCanvas.getContext("2d");

    this.activeAnnotation = {
      type: "highlight",
      pageNumber,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
      color: this.pdfReader.highlighterColor,
      thickness: this.pdfReader.highlighterThickness,
      canvas: highlightCanvas,
      ctx,
      path: [{ x, y }],
      id: `highlight_${Date.now()}_${Math.random()}`, // Add an ID for rendering
    };

    // Set drawing properties with 30% opacity
    ctx.globalCompositeOperation = "multiply";
    ctx.strokeStyle = this.pdfReader.highlighterColor;
    ctx.lineWidth = this.pdfReader.highlighterThickness;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = 0.3; // Set opacity to 30%

    this.lastPoint = { x, y };
  }

  updateAnnotation(x, y) {
    if (!this.activeAnnotation) return;

    const annotation = this.activeAnnotation;

    if (annotation.type === "highlight") {
      const ctx = annotation.ctx;

      // Ensure opacity stays at 30% for highlighting effect
      ctx.globalAlpha = 0.3;
      ctx.globalCompositeOperation = "multiply";

      if (this.shiftPressed && this.lastPoint) {
        let endX = x;
        let endY = y;

        if (this.ctrlPressed) {
          // CTRL+SHIFT: Create strictly horizontal, vertical, or diagonal lines
          const deltaX = Math.abs(x - annotation.startX);
          const deltaY = Math.abs(y - annotation.startY);

          if (deltaX > deltaY) {
            // Horizontal line
            endY = annotation.startY;
          } else if (deltaY > deltaX) {
            // Vertical line
            endX = annotation.startX;
          } else {
            // Diagonal line (45 degrees)
            const distance = Math.max(deltaX, deltaY);
            const signX = x > annotation.startX ? 1 : -1;
            const signY = y > annotation.startY ? 1 : -1;
            endX = annotation.startX + distance * signX;
            endY = annotation.startY + distance * signY;
          }
        }

        // For straight lines, clear the canvas and redraw the single line
        ctx.clearRect(0, 0, annotation.canvas.width, annotation.canvas.height);

        // Redraw the path up to the last point before the straight line
        if (annotation.path.length > 1) {
          ctx.beginPath();
          ctx.moveTo(annotation.path[0].x, annotation.path[0].y);
          for (let i = 1; i < annotation.path.length; i++) {
            ctx.lineTo(annotation.path[i].x, annotation.path[i].y);
          }
          ctx.stroke();
        }

        // Draw the straight line
        ctx.beginPath();
        ctx.moveTo(annotation.startX, annotation.startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Update the current position for the straight line
        annotation.currentX = endX;
        annotation.currentY = endY;
      } else {
        // Free drawing - continue the path smoothly
        ctx.beginPath();
        ctx.moveTo(this.lastPoint.x, this.lastPoint.y);
        ctx.lineTo(x, y);
        ctx.stroke();

        annotation.path.push({ x, y });
        annotation.currentX = x;
        annotation.currentY = y;
      }

      this.lastPoint = { x: annotation.currentX, y: annotation.currentY };
    }
  }

  finalizeAnnotation() {
    if (!this.activeAnnotation) return;

    const annotation = this.activeAnnotation;

    // Store the annotation
    if (!this.annotations.has(annotation.pageNumber)) {
      this.annotations.set(annotation.pageNumber, []);
    }

    // Add data-annotation-id to the canvas for later reference
    if (annotation.type === "highlight") {
      annotation.canvas.setAttribute("data-annotation-id", annotation.id);
    }

    this.annotations.get(annotation.pageNumber).push({
      type: annotation.type,
      data: this.serializeAnnotation(annotation),
      timestamp: Date.now(),
      id: annotation.id,
    });

    this.updateAnnotationsList();
    this.activeAnnotation = null;
    this.lastPoint = null;
  }

  addComment(x, y, pageNumber, pageElement) {
    // Store the pending comment location and show modal
    this.pendingComment = {
      x,
      y,
      pageNumber,
      pageElement,
    };

    // Show the comment modal
    this.pdfReader.showModal("comment-modal");

    // Focus on the textarea
    setTimeout(() => {
      const textarea = document.getElementById("comment-text");
      if (textarea) {
        textarea.focus();
      }
    }, 100);
  }

  saveComment(commentText) {
    if (!this.pendingComment || !commentText || commentText.trim() === "")
      return;

    const { x, y, pageNumber, pageElement } = this.pendingComment;
    const commentId = `comment_${Date.now()}_${Math.random()}`;

    // Create comment container
    const commentContainer = document.createElement("div");
    commentContainer.className = "comment-annotation";
    commentContainer.style.position = "absolute";
    commentContainer.style.left = `${x}px`;
    commentContainer.style.top = `${y}px`;
    commentContainer.style.zIndex = "15";
    commentContainer.style.cursor = "pointer";
    commentContainer.setAttribute("data-comment-id", commentId);

    // Create simple comment icon (no type label)
    const commentIcon = document.createElement("i");
    commentIcon.className = "fas fa-comment";
    commentIcon.style.fontSize = "20px";
    commentIcon.style.color = "#007bff";

    commentContainer.appendChild(commentIcon);

    // Add click handler to show comment
    commentContainer.addEventListener("click", () => {
      this.showCommentPopup(commentText, commentContainer);
    });

    pageElement.style.position = "relative";
    pageElement.appendChild(commentContainer);

    // Store annotation
    if (!this.annotations.has(pageNumber)) {
      this.annotations.set(pageNumber, []);
    }

    this.annotations.get(pageNumber).push({
      type: "comment",
      data: {
        id: commentId,
        pageNumber: pageNumber,
        x,
        y,
        text: commentText,
      },
      timestamp: Date.now(),
      id: commentId,
    });

    this.updateAnnotationsList();

    // Clear pending comment
    this.pendingComment = null;

    // Hide modal
    this.pdfReader.hideModal("comment-modal");

    // Clear textarea
    const textarea = document.getElementById("comment-text");
    if (textarea) {
      textarea.value = "";
    }
  }

  addStamp(x, y, pageNumber, pageElement) {
    const stampId = `stamp_${Date.now()}_${Math.random()}`;
    const stampIcon = this.getStampIcon();

    // Create stamp element
    const stampElement = document.createElement("div");
    stampElement.className = "stamp-annotation";
    stampElement.style.position = "absolute";
    stampElement.style.left = `${x - 25}px`;
    stampElement.style.top = `${y - 25}px`;
    stampElement.style.width = "50px";
    stampElement.style.height = "50px";
    stampElement.style.display = "flex";
    stampElement.style.alignItems = "center";
    stampElement.style.justifyContent = "center";
    stampElement.style.backgroundColor = "rgba(0, 123, 255, 0.1)";
    stampElement.style.border = "2px solid #007bff";
    stampElement.style.borderRadius = "50%";
    stampElement.style.zIndex = "15";
    stampElement.style.cursor = "pointer";
    stampElement.setAttribute("data-stamp-id", stampId);
    stampElement.innerHTML = `<i class="fas fa-${stampIcon}" style="font-size: 24px; color: #007bff;"></i>`;

    // Add resize handles
    const resizeHandle = document.createElement("div");
    resizeHandle.style.position = "absolute";
    resizeHandle.style.bottom = "-5px";
    resizeHandle.style.right = "-5px";
    resizeHandle.style.width = "10px";
    resizeHandle.style.height = "10px";
    resizeHandle.style.backgroundColor = "#007bff";
    resizeHandle.style.borderRadius = "50%";
    resizeHandle.style.cursor = "se-resize";
    resizeHandle.style.zIndex = "16";

    stampElement.appendChild(resizeHandle);

    // Make stamp resizable
    let isResizing = false;
    let startX, startY, startWidth, startHeight;

    resizeHandle.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = parseInt(stampElement.style.width);
      startHeight = parseInt(stampElement.style.height);

      document.addEventListener("mousemove", handleResize);
      document.addEventListener("mouseup", stopResize);
    });

    const handleResize = (e) => {
      if (!isResizing) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      const newWidth = Math.max(20, startWidth + deltaX);
      const newHeight = Math.max(20, startHeight + deltaY);

      stampElement.style.width = `${newWidth}px`;
      stampElement.style.height = `${newHeight}px`;

      // Adjust icon size proportionally
      const icon = stampElement.querySelector("i");
      const iconSize = Math.min(newWidth, newHeight) * 0.4;
      icon.style.fontSize = `${iconSize}px`;
    };

    const stopResize = () => {
      isResizing = false;
      document.removeEventListener("mousemove", handleResize);
      document.removeEventListener("mouseup", stopResize);
    };

    pageElement.style.position = "relative";
    pageElement.appendChild(stampElement);

    // Store annotation
    if (!this.annotations.has(pageNumber)) {
      this.annotations.set(pageNumber, []);
    }

    this.annotations.get(pageNumber).push({
      type: "stamp",
      data: {
        id: stampId,
        pageNumber: pageNumber,
        x: x - 25,
        y: y - 25,
        width: 50,
        height: 50,
        stamp: this.pdfReader.selectedStamp,
        icon: stampIcon,
      },
      timestamp: Date.now(),
      id: stampId,
    });

    this.updateAnnotationsList();
  }

  addSignature(x, y, pageNumber, pageElement) {
    const signatureId = `signature_${Date.now()}_${Math.random()}`;

    // Get the selected signature from the saved signatures
    const selectedSignature = this.pdfReader.getSelectedSignature();

    if (!selectedSignature) {
      alert("Please create and select a signature first.");
      return;
    }

    // Create signature element
    const signatureElement = document.createElement("div");
    signatureElement.className = "signature-annotation";
    signatureElement.style.position = "absolute";
    signatureElement.style.left = `${x - 50}px`;
    signatureElement.style.top = `${y - 15}px`;
    signatureElement.style.width = "100px";
    signatureElement.style.height = "30px";
    signatureElement.style.zIndex = "15";
    signatureElement.style.cursor = "move";
    signatureElement.setAttribute("data-signature-id", signatureId);

    if (selectedSignature.type === "draw") {
      // Display drawn signature
      const img = document.createElement("img");
      img.src = selectedSignature.data;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "contain";
      signatureElement.appendChild(img);
    } else if (selectedSignature.type === "type") {
      // Display typed signature
      signatureElement.style.fontFamily = selectedSignature.font || "cursive";
      signatureElement.style.fontSize = "16px";
      signatureElement.style.color = "#000";
      signatureElement.style.display = "flex";
      signatureElement.style.alignItems = "center";
      signatureElement.style.justifyContent = "center";
      signatureElement.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
      signatureElement.style.border = "1px solid #ccc";
      signatureElement.textContent = selectedSignature.text;
    } else if (selectedSignature.type === "upload") {
      // Display uploaded signature
      const img = document.createElement("img");
      img.src = selectedSignature.data;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "contain";
      signatureElement.appendChild(img);
    }

    // Add resize handle
    const resizeHandle = document.createElement("div");
    resizeHandle.style.position = "absolute";
    resizeHandle.style.bottom = "-5px";
    resizeHandle.style.right = "-5px";
    resizeHandle.style.width = "10px";
    resizeHandle.style.height = "10px";
    resizeHandle.style.backgroundColor = "#007bff";
    resizeHandle.style.borderRadius = "50%";
    resizeHandle.style.cursor = "nw-resize";
    resizeHandle.style.border = "1px solid #fff";
    signatureElement.appendChild(resizeHandle);

    // Add delete button
    const deleteBtn = document.createElement("div");
    deleteBtn.style.position = "absolute";
    deleteBtn.style.top = "-5px";
    deleteBtn.style.right = "-5px";
    deleteBtn.style.width = "16px";
    deleteBtn.style.height = "16px";
    deleteBtn.style.backgroundColor = "#dc3545";
    deleteBtn.style.borderRadius = "50%";
    deleteBtn.style.cursor = "pointer";
    deleteBtn.style.border = "1px solid #fff";
    deleteBtn.style.display = "flex";
    deleteBtn.style.alignItems = "center";
    deleteBtn.style.justifyContent = "center";
    deleteBtn.style.color = "#fff";
    deleteBtn.style.fontSize = "10px";
    deleteBtn.style.fontWeight = "bold";
    deleteBtn.textContent = "×";
    signatureElement.appendChild(deleteBtn);

    // Add event listeners for moving, resizing, and deleting
    this.setupSignatureEvents(signatureElement, signatureId, pageNumber);

    pageElement.style.position = "relative";
    pageElement.appendChild(signatureElement);

    // Store annotation
    if (!this.annotations.has(pageNumber)) {
      this.annotations.set(pageNumber, []);
    }

    this.annotations.get(pageNumber).push({
      type: "signature",
      data: {
        id: signatureId,
        pageNumber: pageNumber,
        x: x - 50,
        y: y - 15,
        width: 100,
        height: 30,
        signature: selectedSignature,
      },
      timestamp: Date.now(),
      id: signatureId,
    });

    this.updateAnnotationsList();
  }

  setupSignatureEvents(signatureElement, signatureId, pageNumber) {
    let isDragging = false;
    let isResizing = false;
    let startX, startY;
    let startLeft, startTop, startWidth, startHeight;

    // Mouse down on signature element
    signatureElement.addEventListener("mousedown", (e) => {
      if (e.target === signatureElement || e.target.tagName === "IMG") {
        // Start dragging
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseInt(signatureElement.style.left);
        startTop = parseInt(signatureElement.style.top);
        signatureElement.style.zIndex = "20";
        e.preventDefault();
      }
    });

    // Mouse down on resize handle
    const resizeHandle = signatureElement.querySelector(
      'div[style*="nw-resize"]'
    );
    if (resizeHandle) {
      resizeHandle.addEventListener("mousedown", (e) => {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(signatureElement.style.width);
        startHeight = parseInt(signatureElement.style.height);
        signatureElement.style.zIndex = "20";
        e.preventDefault();
        e.stopPropagation();
      });
    }

    // Mouse down on delete button
    const deleteBtn = signatureElement.querySelector('div[style*="dc3545"]');
    if (deleteBtn) {
      deleteBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.removeSignature(signatureId, pageNumber);
      });
    }

    // Global mouse move and mouse up
    const handleMouseMove = (e) => {
      if (isDragging) {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        signatureElement.style.left = `${startLeft + deltaX}px`;
        signatureElement.style.top = `${startTop + deltaY}px`;
      } else if (isResizing) {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        const newWidth = Math.max(20, startWidth + deltaX);
        const newHeight = Math.max(20, startHeight + deltaY);

        signatureElement.style.width = `${newWidth}px`;
        signatureElement.style.height = `${newHeight}px`;

        // Adjust icon size proportionally
        const icon = signatureElement.querySelector("img");
        if (icon) {
          const iconSize = Math.min(newWidth, newHeight) * 0.4;
          icon.style.width = `${iconSize}px`;
          icon.style.height = `${iconSize}px`;
        }
      }
    };

    const handleMouseUp = () => {
      if (isDragging || isResizing) {
        isDragging = false;
        isResizing = false;
        signatureElement.style.zIndex = "15";

        // Update annotation data with new position/size
        this.updateSignatureData(signatureId, pageNumber, {
          x: parseInt(signatureElement.style.left),
          y: parseInt(signatureElement.style.top),
          width: parseInt(signatureElement.style.width),
          height: parseInt(signatureElement.style.height),
        });
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }

  updateSignatureData(signatureId, pageNumber, newData) {
    const annotations = this.annotations.get(pageNumber);
    if (!annotations) return;

    const annotation = annotations.find((a) => a.id === signatureId);
    if (annotation) {
      annotation.data = { ...annotation.data, ...newData };
    }
  }

  removeSignature(signatureId, pageNumber) {
    const annotations = this.annotations.get(pageNumber);
    if (!annotations) return;

    const initialLength = annotations.length;
    this.annotations.set(
      pageNumber,
      annotations.filter((annotation) => annotation.id !== signatureId)
    );

    if (annotations.length < initialLength) {
      // Remove visual element
      const pageElement = document.querySelector(
        `.pdf-page[data-page-number="${pageNumber}"]`
      );
      if (pageElement) {
        const signatureElement = pageElement.querySelector(
          `[data-signature-id="${signatureId}"]`
        );
        if (signatureElement) {
          signatureElement.remove();
        }
      }
      this.updateAnnotationsList();
    }
  }

  // getCommentColor() method removed since we're simplifying comments
  // getCommentColor() {
  //     const colors = {
  //         'none': '#808080',
  //         'note': '#4169e1',
  //         'careful': '#ffa500',
  //         'warning': '#b8860b',
  //         'cautious': '#dc143c'
  //     };
  //     return colors[this.pdfReader.commentType] || colors.none;
  // }

  getStampIcon() {
    const icons = {
      check: "check",
      times: "times",
      star: "star",
      "thumbs-up": "thumbs-up",
      heart: "heart",
    };
    return icons[this.pdfReader.selectedStamp] || "check";
  }

  showCommentPopup(text, iconElement) {
    // Remove existing popups
    document
      .querySelectorAll(".comment-popup")
      .forEach((popup) => popup.remove());

    const popup = document.createElement("div");
    popup.className = "comment-popup";
    popup.style.position = "absolute";
    popup.style.backgroundColor = "#fff";
    popup.style.border = "1px solid #ddd";
    popup.style.borderRadius = "4px";
    popup.style.padding = "8px";
    popup.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
    popup.style.zIndex = "100";
    popup.style.maxWidth = "200px";
    popup.style.fontSize = "12px";
    popup.textContent = text;

    const rect = iconElement.getBoundingClientRect();
    popup.style.left = `${rect.right + 5}px`;
    popup.style.top = `${rect.top}px`;

    document.body.appendChild(popup);

    // Remove popup when clicking elsewhere
    setTimeout(() => {
      document.addEventListener(
        "click",
        (e) => {
          if (!popup.contains(e.target) && !iconElement.contains(e.target)) {
            popup.remove();
          }
        },
        { once: true }
      );
    }, 100);
  }

  redrawAnnotations(pageNumber) {
    const annotations = this.annotations.get(pageNumber);
    if (!annotations) return;

    const pageElement = document.querySelector(
      `.pdf-page[data-page-number="${pageNumber}"]`
    );
    if (!pageElement) return;

    // Clear and redraw individual highlight canvases
    pageElement.querySelectorAll(".highlight-canvas").forEach((canvas) => {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    annotations.forEach((annotation) => {
      if (annotation.type === "highlight") {
        this.renderHighlight(annotation.data);
      }
    });
  }

  renderHighlight(data) {
    // Find the corresponding highlight canvas for this annotation
    const pageElement = document.querySelector(
      `.pdf-page[data-page-number="${data.pageNumber}"]`
    );
    if (!pageElement) return;

    const canvas = pageElement.querySelector(
      `.highlight-canvas[data-annotation-id="${data.id}"]`
    );
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    // Set drawing properties with 30% opacity
    ctx.globalCompositeOperation = "multiply";
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.thickness;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = 0.3; // Set opacity to 30%

    if (data.path && data.path.length > 1) {
      ctx.beginPath();
      ctx.moveTo(data.path[0].x, data.path[0].y);

      for (let i = 1; i < data.path.length; i++) {
        ctx.lineTo(data.path[i].x, data.path[i].y);
      }

      ctx.stroke();
    }
  }

  serializeAnnotation(annotation) {
    switch (annotation.type) {
      case "highlight":
        return {
          id: annotation.id,
          pageNumber: annotation.pageNumber,
          startX: annotation.startX,
          startY: annotation.startY,
          currentX: annotation.currentX,
          currentY: annotation.currentY,
          color: annotation.color,
          thickness: annotation.thickness,
          path: annotation.path,
        };
      default:
        return {};
    }
  }

  updateAnnotationsList() {
    const container = document.getElementById("annotations-container");
    container.innerHTML = "";

    if (this.annotations.size === 0) {
      container.innerHTML = '<p class="empty-state">No annotations found</p>';
      return;
    }

    // Create list of all annotations
    const allAnnotations = [];
    for (const [pageNumber, annotations] of this.annotations.entries()) {
      annotations.forEach((annotation) => {
        allAnnotations.push({
          ...annotation,
          pageNumber,
        });
      });
    }

    // Sort by timestamp (newest first)
    allAnnotations.sort((a, b) => b.timestamp - a.timestamp);

    allAnnotations.forEach((annotation) => {
      const item = document.createElement("div");
      item.className = "annotation-item";
      item.style.padding = "8px";
      item.style.borderBottom = "1px solid #eee";
      item.style.cursor = "pointer";

      const type =
        annotation.type.charAt(0).toUpperCase() + annotation.type.slice(1);
      const date = new Date(annotation.timestamp).toLocaleString();

      let preview = "";
      if (annotation.type === "comment") {
        preview = annotation.data.text;
      } else if (annotation.type === "stamp") {
        // Get the stamp type name from the stamp data
        const stampType = annotation.data.stamp;
        const stampNames = {
          check: "Approved",
          times: "Rejected",
          star: "Important",
          "thumbs-up": "Good",
          heart: "Favorite",
        };
        preview = `${stampNames[stampType] || stampType} stamp`;
      } else if (annotation.type === "highlight") {
        preview = "Highlighted text";
      } else if (annotation.type === "signature") {
        preview = "Signature";
      }

      item.innerHTML = `
                <div style="font-weight: bold; font-size: 12px;">${type} - Page ${annotation.pageNumber}</div>
                <div style="font-size: 11px; color: #666;">${preview}</div>
                <div style="font-size: 10px; color: #999;">${date}</div>
            `;

      item.addEventListener("click", () => {
        this.pdfReader.goToPage(annotation.pageNumber);
      });

      container.appendChild(item);
    });
  }

  clearAnnotations(pageNumber = null) {
    if (pageNumber !== null) {
      this.annotations.delete(pageNumber);

      // Clear visual annotations from page
      const pageElement = document.querySelector(
        `.pdf-page[data-page-number="${pageNumber}"]`
      );
      if (pageElement) {
        pageElement
          .querySelectorAll(
            ".highlight-canvas, .comment-annotation, .stamp-annotation, .signature-annotation"
          )
          .forEach((el) => el.remove());
      }
    } else {
      this.annotations.clear();

      // Clear all visual annotations
      document
        .querySelectorAll(
          ".highlight-canvas, .comment-annotation, .stamp-annotation, .signature-annotation"
        )
        .forEach((el) => el.remove());
    }

    this.updateAnnotationsList();
  }

  // Save annotations state for rotation
  saveAnnotationsState() {
    const state = {};
    for (const [pageNumber, annotations] of this.annotations.entries()) {
      state[pageNumber] = annotations.map((annotation) => ({
        ...annotation,
        data: { ...annotation.data },
      }));
    }
    return state;
  }

  // Restore annotations after rotation
  restoreAnnotationsState(state) {
    this.annotations.clear();

    // Clear all visual annotations first
    document
      .querySelectorAll(
        ".highlight-canvas, .comment-annotation, .stamp-annotation, .signature-annotation"
      )
      .forEach((el) => el.remove());

    // Restore annotations data
    for (const [pageNumber, annotations] of Object.entries(state)) {
      this.annotations.set(parseInt(pageNumber), annotations);
    }

    // Re-render all annotations
    for (const [pageNumber, annotations] of this.annotations.entries()) {
      this.renderPageAnnotations(parseInt(pageNumber));
    }

    this.updateAnnotationsList();
  }

  // Render all annotations for a specific page
  renderPageAnnotations(pageNumber) {
    const annotations = this.annotations.get(pageNumber);
    if (!annotations) return;

    const pageElement = document.querySelector(
      `.pdf-page[data-page-number="${pageNumber}"]`
    );
    if (!pageElement) return;

    annotations.forEach((annotation) => {
      if (annotation.type === "highlight") {
        this.renderHighlight(annotation.data);
      } else if (annotation.type === "comment") {
        this.renderComment(annotation.data);
      } else if (annotation.type === "stamp") {
        this.renderStamp(annotation.data);
      } else if (annotation.type === "signature") {
        this.renderSignature(annotation.data);
      }
    });
  }

  // Render individual annotation types
  renderComment(data) {
    const pageElement = document.querySelector(
      `.pdf-page[data-page-number="${data.pageNumber}"]`
    );
    if (!pageElement) return;

    const commentContainer = document.createElement("div");
    commentContainer.className = "comment-annotation";
    commentContainer.style.position = "absolute";
    commentContainer.style.left = `${data.x}px`;
    commentContainer.style.top = `${data.y}px`;
    commentContainer.style.zIndex = "15";
    commentContainer.style.cursor = "pointer";
    commentContainer.setAttribute("data-comment-id", data.id);

    // Create simple comment icon (no type label)
    const commentIcon = document.createElement("i");
    commentIcon.className = "fas fa-comment";
    commentIcon.style.fontSize = "20px";
    commentIcon.style.color = "#007bff";

    commentContainer.appendChild(commentIcon);

    commentContainer.addEventListener("click", () => {
      this.showCommentPopup(data.text, commentContainer);
    });

    pageElement.appendChild(commentContainer);
  }

  renderStamp(data) {
    const pageElement = document.querySelector(
      `.pdf-page[data-page-number="${data.pageNumber}"]`
    );
    if (!pageElement) return;

    const stampElement = document.createElement("div");
    stampElement.className = "stamp-annotation";
    stampElement.style.position = "absolute";
    stampElement.style.left = `${data.x}px`;
    stampElement.style.top = `${data.y}px`;
    stampElement.style.width = `${data.width}px`;
    stampElement.style.height = `${data.height}px`;
    stampElement.style.display = "flex";
    stampElement.style.alignItems = "center";
    stampElement.style.justifyContent = "center";
    stampElement.style.backgroundColor = "rgba(0, 123, 255, 0.1)";
    stampElement.style.border = "2px solid #007bff";
    stampElement.style.borderRadius = "50%";
    stampElement.style.zIndex = "15";
    stampElement.style.cursor = "pointer";
    stampElement.setAttribute("data-stamp-id", data.id);
    stampElement.innerHTML = `<i class="fas fa-${
      data.icon
    }" style="font-size: ${
      Math.min(data.width, data.height) * 0.4
    }px; color: #007bff;"></i>`;

    pageElement.appendChild(stampElement);
  }

  renderSignature(data) {
    const pageElement = document.querySelector(
      `.pdf-page[data-page-number="${data.pageNumber}"]`
    );
    if (!pageElement) return;

    const signatureElement = document.createElement("div");
    signatureElement.className = "signature-annotation";
    signatureElement.style.position = "absolute";
    signatureElement.style.left = `${data.x}px`;
    signatureElement.style.top = `${data.y}px`;
    signatureElement.style.width = "100px";
    signatureElement.style.height = "30px";
    signatureElement.style.zIndex = "15";
    signatureElement.style.cursor = "pointer";
    signatureElement.setAttribute("data-signature-id", data.id);

    const signature = data.signature;
    if (signature.type === "draw" || signature.type === "upload") {
      const img = document.createElement("img");
      img.src = signature.data;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "contain";
      signatureElement.appendChild(img);
    } else if (signature.type === "type") {
      signatureElement.style.fontFamily = signature.font || "cursive";
      signatureElement.style.fontSize = "16px";
      signatureElement.style.color = "#000";
      signatureElement.style.display = "flex";
      signatureElement.style.alignItems = "center";
      signatureElement.style.justifyContent = "center";
      signatureElement.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
      signatureElement.style.border = "1px solid #ccc";
      signatureElement.textContent = signature.text;
    }

    pageElement.appendChild(signatureElement);
  }

  exportAnnotations() {
    const data = {};
    for (const [pageNumber, annotations] of this.annotations.entries()) {
      data[pageNumber] = annotations;
    }
    return JSON.stringify(data, null, 2);
  }

  importAnnotations(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      this.annotations.clear();

      for (const [pageNumber, annotations] of Object.entries(data)) {
        this.annotations.set(parseInt(pageNumber), annotations);
      }

      this.updateAnnotationsList();
      return true;
    } catch (error) {
      console.error("Error importing annotations:", error);
      return false;
    }
  }

  undoLastAnnotation() {
    // Find the most recent annotation across all pages
    let lastAnnotation = null;
    let lastPageNumber = null;

    for (const [pageNumber, annotations] of this.annotations.entries()) {
      if (annotations.length > 0) {
        const last = annotations[annotations.length - 1];
        if (!lastAnnotation || last.timestamp > lastAnnotation.timestamp) {
          lastAnnotation = last;
          lastPageNumber = pageNumber;
        }
      }
    }

    if (lastAnnotation && lastPageNumber !== null) {
      // Remove from storage
      const annotations = this.annotations.get(lastPageNumber);
      annotations.pop();

      // Remove visual element
      if (lastAnnotation.type === "highlight") {
        // Remove the highlight canvas
        const pageElement = document.querySelector(
          `.pdf-page[data-page-number="${lastPageNumber}"]`
        );
        if (pageElement) {
          const canvas = pageElement.querySelector(
            `.highlight-canvas[data-annotation-id="${lastAnnotation.id}"]`
          );
          if (canvas) {
            canvas.remove();
          }
        }
      } else if (lastAnnotation.type === "comment") {
        // Remove comment icon
        const pageElement = document.querySelector(
          `.pdf-page[data-page-number="${lastPageNumber}"]`
        );
        if (pageElement) {
          const commentIcon = pageElement.querySelector(
            `[data-comment-id="${lastAnnotation.id}"]`
          );
          if (commentIcon) {
            commentIcon.remove();
          }
        }
      } else if (lastAnnotation.type === "stamp") {
        // Remove stamp
        const pageElement = document.querySelector(
          `.pdf-page[data-page-number="${lastPageNumber}"]`
        );
        if (pageElement) {
          const stampElement = pageElement.querySelector(
            `[data-stamp-id="${lastAnnotation.id}"]`
          );
          if (stampElement) {
            stampElement.remove();
          }
        }
      } else if (lastAnnotation.type === "signature") {
        // Remove signature
        const pageElement = document.querySelector(
          `.pdf-page[data-page-number="${lastPageNumber}"]`
        );
        if (pageElement) {
          const signatureElement = pageElement.querySelector(
            `[data-signature-id="${lastAnnotation.id}"]`
          );
          if (signatureElement) {
            signatureElement.remove();
          }
        }
      }

      // Update the annotations list
      this.updateAnnotationsList();

      return true;
    }

    return false;
  }
}

// Export for use in renderer.js
window.AnnotationManager = AnnotationManager;

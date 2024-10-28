// js/app.js

// Retrieve current user
const currentUser = localStorage.getItem('currentUser');

// Check if user is logged in
if (!currentUser) {
    window.location.href = 'login.html';
}

// Notebook Data Structure
let notebooks = JSON.parse(localStorage.getItem(`notebooks_${currentUser}`)) || {};

// Current States
let currentSubject = null;
let currentPage = 1;
let currentPaperType = 'plain';

// Drawing Variables
let canvas, ctx;
let drawing = false;
let tool = 'pen';
let brushColor = '#000000';
let brushSize = 5;
let undoStack = [];
let redoStack = [];

// Color Palette
let defaultColors = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00'];
let customColors = JSON.parse(localStorage.getItem('customColors')) || [];

// Initialize the Application
window.onload = function () {
    const currentTheme = localStorage.getItem('theme') || 'dark';
    if (currentTheme === 'dark') {
        setDarkTheme();
    } else {
        setLightTheme();
    }
    loadApplicationState();
    initColorPalette();
    setInterval(saveNotebooks, 5000); // Auto-save every 5 seconds
};

window.onbeforeunload = function () {
    saveNotebooks();
};

// Toggle Sidebar Visibility
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const content = document.querySelector('.content');
    sidebar.classList.toggle('hidden');
    content.classList.toggle('fullscreen');
    // Adjust canvas size when sidebar is toggled
    if (currentSubject) {
        displayPage();
    }
}

// Open Create Notebook Modal
function openCreateNotebookModal() {
    document.getElementById('createNotebookModal').style.display = 'block';
}

// Close Create Notebook Modal
function closeCreateNotebookModal() {
    document.getElementById('createNotebookModal').style.display = 'none';
}

// Create New Notebook
function createNotebook() {
    const notebookName = document.getElementById('notebookName').value.trim();
    const paperType = document.getElementById('paperType').value;
    if (notebookName) {
        if (!notebooks[notebookName]) {
            notebooks[notebookName] = { pages: [], paperType: paperType };
            saveNotebooks();
            displayNotebooks();
            closeCreateNotebookModal();
        } else {
            alert('Notebook already exists.');
        }
    } else {
        alert('Notebook name cannot be empty.');
    }
}

// Save Notebooks
function saveNotebooks() {
    localStorage.setItem(`notebooks_${currentUser}`, JSON.stringify(notebooks));
}

// Display Notebooks in Sidebar
function displayNotebooks() {
    const notebooksContainer = document.getElementById('notebooksContainer');
    notebooksContainer.innerHTML = '';
    for (let notebook in notebooks) {
        const notebookDiv = document.createElement('div');
        notebookDiv.className = 'notebook-item';
        notebookDiv.textContent = capitalize(notebook);
        notebookDiv.onclick = () => openSubject(notebook);
        notebooksContainer.appendChild(notebookDiv);
    }
}

// Open a Notebook
function openSubject(subject) {
    currentSubject = subject;
    currentPage = 1;
    currentPaperType = notebooks[currentSubject].paperType || 'plain';
    document.getElementById('subjectTitle').textContent = capitalize(subject);

    // Show toolbar and pagination
    document.getElementById('toolbar').style.display = 'flex';
    document.querySelector('.pagination-container').style.display = 'flex';

    // Initialize notebook pages if empty
    if (!notebooks[currentSubject].pages.length) {
        notebooks[currentSubject].pages.push('');
    }

    displayPage();
}

// Display the Current Page
function displayPage() {
    // Retrieve the canvas data URL
    const pageContent = notebooks[currentSubject].pages[currentPage - 1] || '';

    // Calculate canvas dimensions
    const contentArea = document.getElementById('contentArea');
    const canvasWidth = contentArea.clientWidth;
    const canvasHeight = window.innerHeight - 250;

    // Create canvas element
    contentArea.innerHTML = `
        <canvas id="drawingCanvas" width="${canvasWidth}" height="${canvasHeight}"></canvas>
    `;

    canvas = document.getElementById('drawingCanvas');
    ctx = canvas.getContext('2d');

    // Adjust canvas size when window resizes
    window.onresize = function () {
        resizeCanvas();
    };

    // Load the saved drawing if it exists
    if (pageContent) {
        const img = new Image();
        img.onload = function () {
            ctx.drawImage(img, 0, 0);
        };
        img.src = pageContent;
    }

    // Add event listeners for drawing
    addCanvasEventListeners();

    document.getElementById('currentPage').textContent = currentPage;
}

// Resize Canvas
function resizeCanvas() {
    const pageContent = canvas.toDataURL();

    const contentArea = document.getElementById('contentArea');
    const canvasWidth = contentArea.clientWidth;
    const canvasHeight = window.innerHeight - 250;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const img = new Image();
    img.onload = function () {
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
    };
    img.src = pageContent;
}

// Add Event Listeners to Canvas
function addCanvasEventListeners() {
    // Mouse events for drawing
    canvas.onmousedown = function (e) {
        startDrawing(e);
    };

    canvas.onmouseup = function (e) {
        stopDrawing(e);
    };

    canvas.onmousemove = function (e) {
        draw(e);
    };

    // Touch events for drawing
    canvas.addEventListener('touchstart', function (e) {
        startDrawing(e.touches[0]);
        e.preventDefault();
    });

    canvas.addEventListener('touchend', function (e) {
        stopDrawing(e.changedTouches[0]);
        e.preventDefault();
    });

    canvas.addEventListener('touchmove', function (e) {
        draw(e.touches[0]);
        e.preventDefault();
    });
}

// Drawing Functions
function startDrawing(e) {
    drawing = true;
    const pos = getMousePos(canvas, e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);

    // Clear redo stack
    redoStack = [];

    if (tool === 'text') {
        const text = prompt('Enter text:');
        if (text) {
            ctx.fillStyle = brushColor;
            ctx.font = `${brushSize * 2}px Arial`;
            ctx.fillText(text, pos.x, pos.y);
            saveCanvasState();
            savePage();
        }
        drawing = false;
    } else if (tool === 'highlighter') {
        ctx.globalAlpha = 0.3;
    }
}

function stopDrawing(e) {
    if (!drawing) return;
    drawing = false;

    ctx.globalAlpha = 1.0;
    ctx.beginPath();

    saveCanvasState();
    savePage();
}

function draw(e) {
    if (!drawing) return;

    const pos = getMousePos(canvas, e);

    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.strokeStyle = (tool === 'eraser') ? 'rgba(255,255,255,1)' : brushColor;
    ctx.globalCompositeOperation = (tool === 'eraser') ? 'destination-out' : 'source-over';

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
}

// Get Mouse Position Relative to Canvas
function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (evt.clientX - rect.left) * (canvas.width / rect.width),
        y: (evt.clientY - rect.top) * (canvas.height / rect.height)
    };
}

// Undo and Redo Functions
function saveCanvasState() {
    if (undoStack.length >= 50) {
        undoStack.shift();
    }
    undoStack.push(canvas.toDataURL());
}

function undo() {
    if (undoStack.length > 1) {
        redoStack.push(undoStack.pop());
        let lastState = undoStack[undoStack.length - 1];
        restoreCanvas(lastState);
    } else if (undoStack.length === 1) {
        redoStack.push(undoStack.pop());
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        savePage();
    }
}

function redo() {
    if (redoStack.length > 0) {
        let nextState = redoStack.pop();
        undoStack.push(nextState);
        restoreCanvas(nextState);
    }
}

function restoreCanvas(dataURL) {
    let img = new Image();
    img.onload = function () {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
    };
    img.src = dataURL || '';
    savePage();
}

// Tool Functions
function setTool(selectedTool) {
    tool = selectedTool;
}

function setColor(color) {
    brushColor = color;
}

function setBrushSize(size) {
    brushSize = size;
}

// Export Functions
function exportAsImage() {
    const dataURL = canvas.toDataURL('image/png');

    const link = document.createElement('a');
    link.href = dataURL;
    link.download = `${currentSubject}_Page${currentPage}.png`;
    link.click();
}

function exportAsPDF() {
    const dataURL = canvas.toDataURL('image/jpeg', 1.0);

    const pdf = new window.jspdf.jsPDF('landscape');
    pdf.addImage(dataURL, 'JPEG', 10, 10, 280, 160);
    pdf.save(`${currentSubject}_Page${currentPage}.pdf`);
}

// Color Palette Functions
function initColorPalette() {
    const palette = document.getElementById('colorPalette');
    palette.innerHTML = '';
    const colors = defaultColors.concat(customColors);
    colors.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = color;
        swatch.onclick = () => setColor(color);
        palette.appendChild(swatch);
    });
}

function addCustomColor(color) {
    if (!customColors.includes(color)) {
        customColors.push(color);
        localStorage.setItem('customColors', JSON.stringify(customColors));
        initColorPalette();
    }
}

// Navigate Pages
function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        displayPage();
    }
}

function nextPage() {
    if (currentPage < notebooks[currentSubject].pages.length) {
        currentPage++;
        displayPage();
    }
}

function addPage() {
    notebooks[currentSubject].pages.push('');
    currentPage = notebooks[currentSubject].pages.length;
    displayPage();
}

// Utility Functions
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Theme Functions
function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'dark';
    if (currentTheme === 'dark') {
        setLightTheme();
    } else {
        setDarkTheme();
    }
}

function setDarkTheme() {
    document.documentElement.style.setProperty('--background-color', '#0D1B2A');
    document.documentElement.style.setProperty('--text-color', '#E0E1DD');
    document.documentElement.style.setProperty('--sidebar-color', '#1B263B');
    document.documentElement.style.setProperty('--accent-color', '#415A77');
    document.documentElement.style.setProperty('--canvas-background', '#FFFFFF');
    localStorage.setItem('theme', 'dark');
}

function setLightTheme() {
    document.documentElement.style.setProperty('--background-color', '#FFFFFF');
    document.documentElement.style.setProperty('--text-color', '#000000');
    document.documentElement.style.setProperty('--sidebar-color', '#E0E1DD');
    document.documentElement.style.setProperty('--accent-color', '#A9A9A9');
    document.documentElement.style.setProperty('--canvas-background', '#FFFFFF');
    localStorage.setItem('theme', 'light');
}

// Load Application State
function loadApplicationState() {
    notebooks = JSON.parse(localStorage.getItem(`notebooks_${currentUser}`)) || {};
    initSidebar();
    displayNotebooks();
}

// Initialize Sidebar
function initSidebar() {
    const subjectList = document.getElementById('subjectList');
    subjectList.innerHTML = '';
    // Add Calendar Link
    const calendarItem = document.createElement('li');
    const calendarLink = document.createElement('a');
    calendarLink.href = 'calendar.html';
    calendarLink.textContent = 'Calendar';
    calendarItem.appendChild(calendarLink);
    subjectList.appendChild(calendarItem);
}

// Save Page Content
function savePage() {
    notebooks[currentSubject].pages[currentPage - 1] = canvas.toDataURL();
    saveNotebooks();
}

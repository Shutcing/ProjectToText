const folderButton = document.getElementById("folderButton");
const fileTree = document.getElementById("fileTree");
const generateButton = document.getElementById("generateButton");
const output = document.getElementById("output");
const copyButton = document.getElementById("copyButton");
const resultContainer = document.getElementById("resultContainer");

const textFileExtensions = new Set([
  "txt",
  "cs",
  "css",
  "js",
  "py",
  "html",
  "json",
  "md",
  "xml",
  "csv",
  "ini",
  "yml",
  "yaml",
  "sh",
  "bat",
  "php",
  "java",
  "c",
  "cpp",
  "h",
  "hpp",
  "ts",
  "rs",
  "go",
  "kt",
  "sql",
  "jsx",
  "tsx",
]);

let fileStructure = [];
let selectedFiles = new Map();

let allFilesMap = new Map();

let selectionRect = null;
let isSelecting = false;
let startX, startY;

folderButton.addEventListener("click", handleFolderUpload);
generateButton.addEventListener("click", generateOutput);
copyButton.addEventListener("click", copyToClipboard);

fileTree.addEventListener("mousedown", handleMouseDown);
document.addEventListener("mousemove", handleMouseMove);
document.addEventListener("mouseup", handleMouseUp);

async function handleFolderUpload() {
  try {
    selectedFiles.clear();
    allFilesMap.clear();

    const directoryHandle = await window.showDirectoryPicker();

    await processDirectory(directoryHandle);

    fileStructure = buildFileStructureFromMap();
    renderFileTree(fileStructure, fileTree);
    fileTree.classList.remove("hidden");
    generateButton.classList.remove("hidden");
    resultContainer.classList.add("hidden");
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error("Error accessing directory:", error);
      alert("Error accessing directory: " + error.message);
    }
  }
}

async function processDirectory(directoryHandle, currentPath = "") {
  for await (const entry of directoryHandle.values()) {
    const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

    if (entry.kind === "directory") {
      if (shouldSkipDirectory(entry.name)) {
        continue;
      }

      await processDirectory(entry, entryPath);
    } else if (entry.kind === "file") {
      if (isTextFile(entry.name)) {
        const file = await entry.getFile();
        file.currentPath = entryPath;

        allFilesMap.set(entryPath, file);
        selectedFiles.set(entryPath, file);
      }
    }
  }
}

function shouldSkipDirectory(dirName) {
  const skipDirs = new Set([
    "node_modules",
    ".git",
    ".svn",
    ".hg",
    ".idea",
    "__pycache__",
    "build",
    "dist",
  ]);
  return skipDirs.has(dirName);
}

function buildFileStructureFromMap() {
  const structure = {};

  for (const [path, file] of allFilesMap.entries()) {
    const pathParts = path.split("/");
    let currentLevel = structure;

    pathParts.forEach((part, index) => {
      const isFile = index === pathParts.length - 1;

      if (!currentLevel[part]) {
        if (isFile) {
          currentLevel[part] = {
            type: "file",
            file: file,
            path: path,
          };
        } else {
          currentLevel[part] = {
            type: "folder",
            children: {},
            path: pathParts.slice(0, index + 1).join("/"),
          };
        }
      }

      if (!isFile) {
        currentLevel = currentLevel[part].children;
      }
    });
  }

  return convertToArray(structure);
}

function isTextFile(fileName) {
  const extension = fileName.split(".").pop().toLowerCase();
  return textFileExtensions.has(extension);
}

function convertToArray(structure) {
  return Object.entries(structure)
    .map(([name, item]) => ({
      name,
      ...item,
      children: item.children ? convertToArray(item.children) : [],
    }))
    .sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === "folder" ? -1 : 1;
    });
}

function renderFileTree(items, parentElement, level = 0) {
  if (level === 0) {
    parentElement.innerHTML = "";
  }

  items.forEach((item) => {
    const element = document.createElement("div");
    element.className = "tree-item";
    element.style.paddingLeft = `${level * 20}px`;

    element.dataset.path = item.path;

    if (item.type === "folder") {
      element.innerHTML = `
        <div class="folder-header">
            <input type="checkbox" checked>
            <span class="folder-icon"></span>
            <span class="folder-name">${item.name}</span>
        </div>
        <div class="children"></div>
      `;
      const childrenContainer = element.querySelector(".children");
      const checkbox = element.querySelector('input[type="checkbox"]');
      const folderHeader = element.querySelector(".folder-header");

      folderHeader
        .querySelector(".folder-name")
        .addEventListener("click", () => element.classList.toggle("collapsed"));
      folderHeader
        .querySelector(".folder-icon")
        .addEventListener("click", () => element.classList.toggle("collapsed"));

      checkbox.addEventListener("change", (e) => {
        const isChecked = e.target.checked;
        const childCheckboxes = element.querySelectorAll(
          '.children input[type="checkbox"]'
        );
        childCheckboxes.forEach((cb) => (cb.checked = isChecked));

        const descendantItems = element.querySelectorAll(
          ".children .tree-item"
        );
        descendantItems.forEach((descItem) => {
          const path = descItem.dataset.path;
          const file = allFilesMap.get(path);
          if (file) {
            selectedFiles.set(path, isChecked ? file : null);
          }
        });
      });

      renderFileTree(item.children, childrenContainer, level + 1);
    } else {
      element.innerHTML = `
        <label class="checkbox-label">
            <input type="checkbox" checked data-path="${item.file.currentPath}">
            <span class="file-icon"></span>
            <span>${item.name}</span>
        </label>
      `;

      const checkbox = element.querySelector("input");
      checkbox.addEventListener("change", () => {
        selectedFiles.set(
          item.file.currentPath,
          checkbox.checked ? item.file : null
        );
      });

      selectedFiles.set(item.file.currentPath, item.file);
    }

    parentElement.appendChild(element);
  });
}

async function generateOutput() {
  const filesToProcess = Array.from(selectedFiles.values()).filter(Boolean);

  if (filesToProcess.length === 0) {
    output.textContent =
      "No files selected. Please check some files or folders.";
    resultContainer.classList.remove("hidden");
    fileTree.classList.add("hidden");
    generateButton.classList.add("hidden");
    return;
  }

  const results = await Promise.all(
    filesToProcess.map(async (file) => {
      return {
        path: file.currentPath,
        content: await readFileContent(file),
      };
    })
  );

  const outputText = results
    .map(({ path, content }) => {
      const extension = path.split(".").pop();
      return `\`\`\`${extension}\n${path}\n\n${content}\n\`\`\``;
    })
    .join("\n\n---\n\n");

  output.textContent = outputText;
  resultContainer.classList.remove("hidden");
  fileTree.classList.add("hidden");
  generateButton.classList.add("hidden");
}

function readFileContent(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result.replace(/\r\n/g, "\n"));
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(output.textContent);
    copyButton.textContent = "Copied!";
    setTimeout(() => {
      copyButton.textContent = "Copy to Clipboard";
    }, 2000);
  } catch (err) {
    console.error("Failed to copy:", err);
  }
}

function handleMouseDown(e) {
  if (e.ctrlKey && e.button === 0) {
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;

    if (!selectionRect) {
      selectionRect = document.createElement("div");
      selectionRect.style.cssText = `
        position: fixed;
        border: 2px dashed #007acc;
        background: rgba(0, 122, 204, 0.1);
        pointer-events: none;
        z-index: 1000;
        display: none;
      `;
      document.body.appendChild(selectionRect);
    }

    selectionRect.style.left = startX + "px";
    selectionRect.style.top = startY + "px";
    selectionRect.style.width = "0px";
    selectionRect.style.height = "0px";
    selectionRect.style.display = "block";

    e.preventDefault();
  }
}

function handleMouseMove(e) {
  if (!isSelecting) return;

  const currentX = e.clientX;
  const currentY = e.clientY;

  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);

  selectionRect.style.left = left + "px";
  selectionRect.style.top = top + "px";
  selectionRect.style.width = width + "px";
  selectionRect.style.height = height + "px";
}

function handleMouseUp(e) {
  if (isSelecting && e.button === 0) {
    isSelecting = false;
    const rect = selectionRect.getBoundingClientRect();
    selectionRect.style.display = "none";

    const checkboxes = fileTree.querySelectorAll(
      'input[type="checkbox"]:checked'
    );

    checkboxes.forEach((checkbox) => {
      const checkboxRect = checkbox.getBoundingClientRect();

      if (
        rect.left <= checkboxRect.right &&
        rect.right >= checkboxRect.left &&
        rect.top <= checkboxRect.bottom &&
        rect.bottom >= checkboxRect.top
      ) {
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }
}

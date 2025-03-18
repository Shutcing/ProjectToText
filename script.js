const folderInput = document.getElementById("folderInput");
const fileTree = document.getElementById("fileTree");
const generateButton = document.getElementById("generateButton");
const output = document.getElementById("output");
const copyButton = document.getElementById("copyButton");
const resultContainer = document.getElementById("resultContainer");

const textFileExtensions = new Set([
  "txt",
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
]);

let fileStructure = [];
let selectedFiles = new Map();

folderInput.addEventListener("change", handleFolderUpload);
generateButton.addEventListener("click", generateOutput);
copyButton.addEventListener("click", copyToClipboard);

async function handleFolderUpload(event) {
  const files = Array.from(event.target.files);
  fileStructure = buildFileStructure(files);
  renderFileTree(fileStructure);
  fileTree.classList.remove("hidden");
  generateButton.classList.remove("hidden");
  resultContainer.classList.add("hidden");
}

function buildFileStructure(files) {
  const structure = {};

  files.forEach((file) => {
    if (!isTextFile(file)) return;

    const pathParts = file.webkitRelativePath.split("/");
    let currentLevel = structure;

    pathParts.forEach((part, index) => {
      if (!currentLevel[part]) {
        currentLevel[part] =
          index === pathParts.length - 1
            ? { type: "file", file }
            : { type: "folder", children: {} };
      }
      if (index !== pathParts.length - 1) {
        currentLevel = currentLevel[part].children;
      }
    });
  });

  return convertToArray(structure);
}

function isTextFile(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  return textFileExtensions.has(extension);
}

function convertToArray(structure) {
  return Object.entries(structure).map(([name, item]) => ({
    name,
    ...item,
    children: item.children ? convertToArray(item.children) : [],
  }));
}

function renderFileTree(items, parentElement = fileTree, level = 0) {
  parentElement.innerHTML = "";

  items.forEach((item) => {
    const element = document.createElement("div");
    element.className = "tree-item";
    element.style.paddingLeft = `${level * 20}px`;

    if (item.type === "folder") {
      element.innerHTML = `
                <div class="folder">
                    <span class="folder-icon"></span>
                    <span>${item.name}</span>
                </div>
                <div class="children"></div>
            `;

      const folderHeader = element.querySelector(".folder");
      const childrenContainer = element.querySelector(".children");

      folderHeader.addEventListener("click", () => {
        element.classList.toggle("collapsed");
      });

      renderFileTree(item.children, childrenContainer, level + 1);
    } else {
      element.innerHTML = `
                <label class="checkbox-label">
                    <input type="checkbox" checked data-path="${item.file.webkitRelativePath}">
                    <span class="file-icon"></span>
                    <span>${item.name}</span>
                </label>
            `;

      const checkbox = element.querySelector("input");
      checkbox.addEventListener("change", () => {
        selectedFiles.set(
          item.file.webkitRelativePath,
          checkbox.checked ? item.file : null
        );
      });

      selectedFiles.set(item.file.webkitRelativePath, item.file);
    }

    parentElement.appendChild(element);
  });
}

async function generateOutput() {
  const filesToProcess = Array.from(selectedFiles.values()).filter(Boolean);

  const results = await Promise.all(
    filesToProcess.map(async (file) => ({
      path: file.webkitRelativePath,
      content: await readFileContent(file),
    }))
  );

  let outputText = results.concat(
    Array.from(selectedFiles.keys()).filter(
      (path) => !filesToProcess.find((f) => f?.webkitRelativePath === path)
    )
  );

  //   .map(({ path, content } = {}) => {
  //     if (!content) return path; // Файл без галочки
  //     return `${path}\n${content}`;
  //   })

  outputText = outputText
    .map(({ path, content } = {}) => {
      if (!content) return path; // Файл без галочки
      return `${path}\n${content}`;
    })
    .join("\n\n");

  console.log(outputText);
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

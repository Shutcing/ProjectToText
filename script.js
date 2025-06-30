const folderInput = document.getElementById("folderInput");
const fileTree = document.getElementById("fileTree");
const generateButton = document.getElementById("generateButton");
const output = document.getElementById("output");
const copyButton = document.getElementById("copyButton");
const resultContainer = document.getElementById("resultContainer");

const textFileExtensions = new Set([
  "txt", "cs", "css", "js", "py", "html", "json", "md", "xml", "csv",
  "ini", "yml", "yaml", "sh", "bat", "php", "java", "c", "cpp", "h",
  "hpp", "ts", "rs", "go", "kt", "sql", "jsx", "tsx"
]);

let fileStructure = [];
let selectedFiles = new Map();
// НОВОЕ: Карта для быстрого доступа ко всем файлам по их пути
let allFilesMap = new Map();

folderInput.addEventListener("change", handleFolderUpload);
generateButton.addEventListener("click", generateOutput);
copyButton.addEventListener("click", copyToClipboard);

async function handleFolderUpload(event) {
  const files = Array.from(event.target.files);
  // Очищаем предыдущие данные
  selectedFiles.clear();
  allFilesMap.clear();

  // Заполняем allFilesMap только текстовыми файлами
  files.forEach(file => {
    if (isTextFile(file)) {
      allFilesMap.set(file.webkitRelativePath, file);
    }
  });

  fileStructure = buildFileStructure(files);
  renderFileTree(fileStructure, fileTree);
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
    let currentPath = [];

    pathParts.forEach((part, index) => {
      currentPath.push(part);
      const isFile = index === pathParts.length - 1;

      if (!currentLevel[part]) {
        if (isFile) {
          currentLevel[part] = { 
            type: "file", 
            file, 
            path: file.webkitRelativePath 
          };
        } else {
          currentLevel[part] = {
            type: "folder",
            children: {},
            // ИЗМЕНЕНО: Папки теперь тоже имеют путь
            path: currentPath.join('/'),
          };
        }
      }
      if (!isFile) {
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
  })).sort((a, b) => { // Сортируем: папки сначала, потом файлы
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'folder' ? -1 : 1;
  });
}

// ИЗМЕНЕНО: Функция рендеринга полностью переработана
function renderFileTree(items, parentElement, level = 0) {
  if (level === 0) {
    parentElement.innerHTML = "";
  }

  items.forEach((item) => {
    const element = document.createElement("div");
    element.className = "tree-item";
    element.style.paddingLeft = `${level * 20}px`;
    // Устанавливаем data-атрибут с путем для легкого поиска
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
      const folderHeader = element.querySelector('.folder-header');

      // Клик по названию/иконке сворачивает/разворачивает
      folderHeader.querySelector('.folder-name').addEventListener('click', () => element.classList.toggle("collapsed"));
      folderHeader.querySelector('.folder-icon').addEventListener('click', () => element.classList.toggle("collapsed"));

      // Клик по чекбоксу меняет состояние всех дочерних элементов
      checkbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const childCheckboxes = element.querySelectorAll('.children input[type="checkbox"]');
        childCheckboxes.forEach(cb => cb.checked = isChecked);

        // Обновляем состояние в `selectedFiles` для всех дочерних файлов
        const descendantItems = element.querySelectorAll('.children .tree-item');
        descendantItems.forEach(descItem => {
          const path = descItem.dataset.path;
          const file = allFilesMap.get(path);
          if (file) { // Убеждаемся, что это файл
             selectedFiles.set(path, isChecked ? file : null);
          }
        });
      });

      renderFileTree(item.children, childrenContainer, level + 1);
    } else { // Рендеринг файла
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
      // Изначально все файлы выбраны
      selectedFiles.set(item.file.webkitRelativePath, item.file);
    }

    parentElement.appendChild(element);
  });
}

async function generateOutput() {
  const filesToProcess = Array.from(selectedFiles.values()).filter(Boolean);

  if (filesToProcess.length === 0) {
      output.textContent = "No files selected. Please check some files or folders.";
      resultContainer.classList.remove("hidden");
      fileTree.classList.add("hidden");
      generateButton.classList.add("hidden");
      return;
  }

  const results = await Promise.all(
    filesToProcess.map(async (file) => ({
      path: file.webkitRelativePath,
      content: await readFileContent(file),
    }))
  );

  const outputText = results
    .map(({ path, content }) => {
      // Оборачиваем код в блоки для лучшей читаемости, особенно для Markdown
      const extension = path.split('.').pop();
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

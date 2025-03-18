const folderInput = document.getElementById("folderInput");
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

folderInput.addEventListener("change", handleFolderUpload);
copyButton.addEventListener("click", copyToClipboard);

async function handleFolderUpload(event) {
  const files = Array.from(event.target.files);
  const textFiles = files.filter((file) => {
    const extension = file.name.split(".").pop().toLowerCase();
    return textFileExtensions.has(extension);
  });

  const results = await Promise.all(
    textFiles.map(async (file) => ({
      path: file.webkitRelativePath,
      content: await readFileContent(file),
    }))
  );

  results.sort((a, b) => a.path.localeCompare(b.path));

  const outputText = results
    .map(({ path, content }) => {
      const formattedContent = content
        .split("\n")
        .map((line) => `${line}`)
        .join("\n");
      return `${path}\n${formattedContent}`;
    })
    .join("\n\n");

  output.textContent = outputText;
  resultContainer.classList.remove("hidden");
}

function readFileContent(file) {
  return new Promise((resolve, reject) => {
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
